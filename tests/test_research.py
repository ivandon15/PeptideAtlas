import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from server.store import Store
from server.research import collect, plan


class ResearchTests(unittest.TestCase):
    def test_scopes(self):
        self.assertEqual(
            {q["scope"] for q in plan("IL23R")["queries"]},
            {"discovery", "optimization", "translation", "cmc", "clinical", "business"},
        )

    def test_independent_entries_and_shared_bridge(self):
        target = plan("IL23R", ["IL-23R", "白细胞介素23受体"])
        company = plan("Hansoh", ["翰森", "豪森"], "company")
        self.assertEqual(target["skill"], "peptide-target-research")
        self.assertEqual(target["bridge"]["skill"], company["skill"])
        self.assertEqual(company["bridge"]["skill"], target["skill"])
        self.assertNotIn("target", company)
        self.assertEqual(
            {q["scope"] for q in company["queries"]},
            {"identity", "portfolio", "partnerships", "patents", "execution", "capital"},
        )
        self.assertTrue(any("翰森" in q["query"] for q in company["queries"]))
        with self.assertRaises(ValueError):
            plan("bad", kind="other")

    def test_platform_discovery_does_not_require_peptide_keyword(self):
        result = plan("Syneron Bio", ["元思生肽"], "company")
        self.assertTrue(
            any(
                q["scope"] == "partnerships"
                and "platform access" in q["query"]
                and "peptide" not in q["query"]
                for q in result["queries"]
            )
        )
        self.assertTrue(any("annual report" in q["query"] for q in result["queries"]))

    def test_target_plan_contains_method_and_redesign_routes(self):
        result = plan("HER2", ["ERBB2"])
        self.assertTrue(any("PepMimic" in q["query"] for q in result["queries"]))
        self.assertTrue(any("interface mimicry" in q["query"] for q in result["queries"]))

    def test_company_only_updates_need_no_target_or_molecule(self):
        with tempfile.TemporaryDirectory() as root:
            store = Store(root, seed=False)
            source = {
                "id": "test-company-source",
                "title": "Test-only public disclosure fixture",
                "url": "https://example.org/test",
                "kind": "company",
                "publishedAt": None,
                "checkedAt": "2026-10-26",
                "access": "metadata",
            }
            records = {
                "companies": [
                    {"id": "test-licensor", "name": "Test licensor"},
                    {"id": "test-licensee", "name": "Test licensee"},
                ],
                "sources": [source],
                "deals": [
                    {
                        "id": "test-platform",
                        "name": "Undisclosed-target peptide platform fixture",
                        "fromCompanyId": "test-licensor",
                        "toCompanyId": "test-licensee",
                        "sourceIds": [source["id"]],
                        "targetIds": [],
                        "moleculeIds": [],
                        "date": None,
                        "stageAtSigning": "未披露",
                        "rationale": {"kind": "undisclosed", "text": "未披露"},
                        "locator": "test fixture",
                    }
                ],
            }
            store.commit({"baseRevision": 0, "reviewer": "Isolated test", "records": records})
            self.assertEqual(store.state()["targets"], [])
            self.assertEqual(store.state()["molecules"], [])
            self.assertEqual(len(store.state()["deals"]), 1)

    def test_company_receipt_cannot_reference_missing_company(self):
        with tempfile.TemporaryDirectory() as root:
            store = Store(root, seed=False)
            with self.assertRaisesRegex(ValueError, "companyIds"):
                store.commit(
                    {
                        "baseRevision": 0,
                        "reviewer": "Isolated test",
                        "records": {
                            "receipts": [
                                {
                                    "id": "bad-ref",
                                    "query": "test",
                                    "tool": "test",
                                    "date": "2026-10-26",
                                    "status": "partial",
                                    "companyIds": ["missing"],
                                }
                            ]
                        },
                    }
                )

    def test_bounded_pages_and_registry_aliases(self):
        calls = []

        def fetch(url):
            calls.append(url)
            if "europepmc" in url:
                return {
                    "resultList": {"result": [{"id": "candidate"}]},
                    "hitCount": 10,
                    "nextCursorMark": str(len(calls)),
                }
            return {"studies": [{"protocolSection": {}}], "totalCount": 1}

        with tempfile.TemporaryDirectory() as root:
            store = Store(root)
            with patch("server.research.fetch_json", side_effect=fetch):
                collect(store, "il23r", 36500, 1, 2)
            receipts = [
                r
                for r in store.state()["receipts"]
                if r["tool"] in ["Europe PMC", "ClinicalTrials.gov"] and r.get("maxPages") == 2
            ]
            pmc = next(r for r in receipts if r["tool"] == "Europe PMC")
            ct = next(r for r in receipts if r["tool"] == "ClinicalTrials.gov")
            self.assertEqual(pmc["count"], 2)
            self.assertTrue(pmc["truncated"])
            self.assertEqual(pmc["status"], "partial")
            self.assertIn("TITLE_ABS:", pmc["query"])
            self.assertIn("JNJ-77242113", ct["query"])
            self.assertNotIn("AND (peptide", ct["query"])
            self.assertEqual(ct["count"], 1)
            self.assertFalse(ct["truncated"])
            self.assertTrue((Path(root) / "raw" / pmc["rawFile"]).exists())

    def test_failure_after_page_preserves_partial_result(self):
        def fetch(url):
            if "cursorMark=%2A" in url:
                return {"resultList": {"result": [{}]}, "hitCount": 5, "nextCursorMark": "next"}
            raise OSError("simulated network failure")

        with tempfile.TemporaryDirectory() as root:
            store = Store(root)
            with patch("server.research.fetch_json", side_effect=fetch):
                collect(store, "il23r", 365, 1, 2)
            rs = [
                r
                for r in store.state()["receipts"]
                if r.get("error") == "simulated network failure"
            ]
            self.assertEqual(sorted(r["status"] for r in rs), ["failed", "partial"])
            self.assertEqual(sum(r["count"] for r in rs), 1)


if __name__ == "__main__":
    unittest.main()

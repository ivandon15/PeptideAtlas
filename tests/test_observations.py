import copy
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from server.store import Store, Invalid


class ObservationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Store(self.tmp.name)
        self.s = self.store.state()

    def tearDown(self):
        self.tmp.cleanup()

    def commit(self, records):
        return self.store.commit(
            {
                "baseRevision": self.store.state()["revision"],
                "reviewer": "Isolated workflow test",
                "records": records,
            }
        )

    def observation(self):
        d = self.s["deals"][0]
        return dict(
            id="test-observation",
            title="Test-only conclusion",
            asOf="2026-10-27",
            author="Test",
            basedOnRevision=self.s["revision"],
            coverage="Isolated fixture",
            summary="A reported agreement",
            interpretation="Testable hypothesis",
            uncertainty="No full coverage",
            nextCheck="Check subsequent primary disclosure",
            status="active",
            sourceIds=d["sourceIds"],
            evidenceIds=[],
            dealIds=[d["id"]],
        )

    def test_saved_observation_and_automatic_review_history(self):
        o = self.observation()
        self.commit({"observations": [o]})
        d = copy.deepcopy(self.s["deals"][0])
        self.assertEqual(self.commit({"deals": [d]})["changed"], [])
        d["financialNotes"] = "New information in isolated fixture"
        self.commit({"deals": [d]})
        current = self.store.state()["observations"][0]
        self.assertEqual(current["status"], "needs-review")
        h = self.store.history("observations", o["id"])
        self.assertEqual(len(h), 2)
        self.assertEqual(h[0]["before"]["status"], "active")
        current.update(status="active", basedOnRevision=self.store.state()["revision"])
        self.commit({"observations": [current]})
        self.assertEqual(self.store.state()["observations"][0]["status"], "active")

    def test_checking_date_alone_does_not_stale_observation(self):
        o = self.observation()
        self.commit({"observations": [o]})
        source = copy.deepcopy(next(p for p in self.s["sources"] if p["id"] in o["sourceIds"]))
        source["checkedAt"] = "2026-10-28"
        self.commit({"sources": [source]})
        self.assertEqual(self.store.state()["observations"][0]["status"], "active")

    def test_missing_evidence_sources_and_future_revision_rejected(self):
        o = self.observation()
        for patch in (
            {"sourceIds": []},
            {"dealIds": []},
            {"basedOnRevision": 999999},
            {"uncertainty": ""},
        ):
            with self.assertRaises(Invalid):
                self.commit({"observations": [{**o, **patch}]})

    def test_candidate_cannot_be_an_active_observation_basis(self):
        e = copy.deepcopy(next(x for x in self.s["evidence"] if x["verification"] == "reviewed"))
        e.update(id="test-candidate", verification="candidate")
        o = self.observation()
        o.update(dealIds=[], evidenceIds=[e["id"]], sourceIds=[e["sourceId"]])
        with self.assertRaisesRegex(Invalid, "候选"):
            self.commit({"evidence": [e], "observations": [o]})

    def test_company_material_closes_business_gap_without_fake_molecule(self):
        d = self.s["deals"][0]
        company = d["fromCompanyId"]
        source = d["sourceIds"][0]
        e = dict(
            id="company-evidence-test",
            title="Business source check",
            summary="Isolated test-only supported disclosure",
            sourceId=source,
            locator="Test disclosure paragraph",
            date="2026-10-27",
            line="business",
            verification="reviewed",
            outcome="reported",
            moleculeIds=[],
            seriesIds=[],
            companyIds=[company],
            dealIds=[d["id"]],
        )
        g = dict(
            id="company-gap-test",
            title="Payment question",
            reason="Need primary source",
            requested="Official disclosure",
            reasonType="undisclosed",
            companyIds=[company],
            dealIds=[d["id"]],
            targetIds=[],
            moleculeIds=[],
            seriesIds=[],
            sourceIds=[source],
            urls=[],
            status="resolved",
            resolution="Test resolution based on direct evidence",
            resolutionEvidenceIds=[e["id"]],
        )
        self.commit({"evidence": [e], "gaps": [g]})
        self.assertEqual(
            next(x for x in self.store.state()["gaps"] if x["id"] == g["id"])["status"], "resolved"
        )
        packet = self.store.packet(g["id"])
        self.assertEqual(packet["companies"][0]["id"], company)
        self.assertEqual(packet["deals"][0]["id"], d["id"])
        e["dealIds"] = []
        with self.assertRaisesRegex(Invalid, "不相关"):
            self.commit({"evidence": [e]})
        e["dealIds"] = [d["id"]]
        e["stageClaim"] = "phase1"
        with self.assertRaisesRegex(Invalid, "不能声明分子阶段"):
            self.commit({"evidence": [e]})

    def test_four_skill_entries_are_portable_and_discoverable(self):
        root = Path(__file__).resolve().parents[1]
        entries = json.loads(
            subprocess.check_output([sys.executable, str(root / "atlas.py"), "skills"], cwd=root)
        )
        self.assertEqual(len(entries), 4)
        for item in entries:
            self.assertTrue((root / item["entry"]).is_file())

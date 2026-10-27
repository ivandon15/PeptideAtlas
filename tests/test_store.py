import copy
import hashlib
import io
import json
import sys
import tempfile
import threading
import unittest
import urllib.request
import urllib.error
from pathlib import Path
from http.client import HTTPConnection
import sqlite3

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server.store import Store, Invalid, Conflict
from server.http import Handler, ThreadingHTTPServer


class StoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Store(self.tmp.name)
        self.initial = self.store.state()

    def tearDown(self):
        self.tmp.cleanup()

    def patch(self, records, rev=None):
        return self.store.commit(
            {
                "baseRevision": self.store.state()["revision"] if rev is None else rev,
                "reviewer": "Test isolated database",
                "records": records,
            }
        )

    def test_seed_and_idempotent(self):
        self.assertEqual(
            len(self.initial["molecules"]),
            len(
                json.loads(
                    (Path(__file__).resolve().parents[1] / "data/pilot.json").read_text(
                        encoding="utf-8"
                    )
                )["molecules"]
            ),
        )
        r = self.patch({"molecules": self.initial["molecules"]})
        self.assertEqual(r["changed"], [])
        self.assertEqual(r["revision"], 1)

    def test_database_connection_is_released_after_use(self):
        with self.store.connect() as connection:
            self.assertEqual(connection.execute("SELECT 1").fetchone()[0], 1)
        with self.assertRaises(sqlite3.ProgrammingError):
            connection.execute("SELECT 1")

    def test_tracking_role_requires_a_valid_role_and_basis(self):
        molecule = copy.deepcopy(self.initial["molecules"][0])
        for fields in (
            {"trackingRole": "clinical-candidate"},
            {"trackingRole": "research", "trackingRoleNote": ""},
        ):
            with self.assertRaisesRegex(Invalid, "追踪角色"):
                self.patch({"molecules": [dict(molecule, **fields)]})
        self.assertEqual(self.store.state(), self.initial)

    def test_stale_revision_and_atomic_rollback(self):
        with self.assertRaises(Conflict):
            self.patch({"targets": []}, rev=0)
        with self.assertRaises(Invalid):
            self.patch(
                {
                    "targets": [{"id": "new", "name": "New"}],
                    "molecules": [dict(self.initial["molecules"][0], seriesId="missing")],
                }
            )
        self.assertEqual(self.store.state(), self.initial)

    def test_stage_cannot_come_from_unrelated_or_planned_experiment(self):
        m = copy.deepcopy(next(x for x in self.initial["molecules"] if x["id"] == "aube00"))
        m["stage"] = "phase2"
        with self.assertRaisesRegex(Invalid, "明确阶段"):
            self.patch({"molecules": [m]})
        m["stage"] = "phase1"
        m["stageEvidenceIds"] = ["luna-phase1"]
        with self.assertRaises(Invalid):
            self.patch({"molecules": [m]})
        e = copy.deepcopy(next(x for x in self.initial["evidence"] if x["id"] == "aube-phase1"))
        e["outcome"] = "planned"
        with self.assertRaises(Invalid):
            self.patch({"evidence": [e]})

    def test_candidate_nomination_requires_explicit_date(self):
        e = copy.deepcopy(self.initial["evidence"][0])
        e.update(id="pcc-invalid", candidateClaim=True, date=None)
        with self.assertRaisesRegex(Invalid, "PCC"):
            self.patch({"evidence": [e]})
        e["date"] = "2024-01-01"
        e["outcome"] = "planned"
        with self.assertRaisesRegex(Invalid, "PCC"):
            self.patch({"evidence": [e]})

    def test_cmc_cannot_promote_stage(self):
        e = copy.deepcopy(next(x for x in self.initial["evidence"] if x.get("topic") == "cmc"))
        e["stageClaim"] = "phase3"
        with self.assertRaisesRegex(Invalid, "CMC"):
            self.patch({"evidence": [e]})

    def test_cycles_rejected(self):
        edge = copy.deepcopy(self.initial["relations"][0])
        edge.update(id="cycle", **{"from": edge["to"], "to": edge["from"]})
        with self.assertRaisesRegex(Invalid, "循环"):
            self.patch({"relations": [edge]})

    def test_history_preserves_both_versions(self):
        m = copy.deepcopy(self.initial["molecules"][0])
        old = m["description"]
        m["description"] = "A reviewed correction"
        self.patch({"molecules": [m]})
        h = self.store.history("molecules", m["id"])
        self.assertEqual(h[0]["before"]["description"], old)
        self.assertEqual(h[0]["after"]["description"], m["description"])
        self.assertEqual(len(h), 2)

    def test_expanded_business_event_types(self):
        for kind in ("platform", "acquisition", "amendment"):
            d = copy.deepcopy(self.initial["deals"][0])
            d.update(id="kind-" + kind, eventKind=kind)
            self.patch({"deals": [d]})
        d.update(eventKind="acquisition", acquisitionScope="company")
        self.patch({"deals": [d]})
        d["acquisitionScope"] = "invalid"
        with self.assertRaisesRegex(Invalid, "收购范围"):
            self.patch({"deals": [d]})
        d.pop("acquisitionScope")
        d["eventKind"] = "unsupported"
        with self.assertRaisesRegex(Invalid, "商业事件类型"):
            self.patch({"deals": [d]})

    def test_company_alias_must_resolve_directly(self):
        canonical = self.initial["companies"][0]["id"]
        self.patch(
            {
                "companies": [
                    {
                        "id": "old-company",
                        "name": "Historical spelling",
                        "canonicalCompanyId": canonical,
                    }
                ]
            }
        )
        with self.assertRaisesRegex(Invalid, "规范公司"):
            self.patch(
                {
                    "companies": [
                        {"id": "bad-company", "name": "Bad", "canonicalCompanyId": "missing"}
                    ]
                }
            )
        with self.assertRaisesRegex(Invalid, "直接指向"):
            self.patch(
                {
                    "companies": [
                        {
                            "id": "chain-company",
                            "name": "Chain",
                            "canonicalCompanyId": "old-company",
                        }
                    ]
                }
            )

    def test_nonfinite_values_rejected(self):
        with self.assertRaises(ValueError):
            self.patch({"targets": [{"id": "bad", "name": "Bad", "number": float("nan")}]})
        self.assertEqual(self.store.state()["revision"], 1)

    def test_html_does_not_pass_and_deduplicates(self):
        r = self.store.add_upload("aube-structure", "../login.pdf", b"<html>please login</html>")
        self.assertEqual(r["upload"]["name"], "login.pdf")
        self.assertEqual(r["upload"]["formatCheck"]["status"], "rejected")
        g = next(x for x in self.store.state()["gaps"] if x["id"] == "aube-structure")
        self.assertEqual(g["status"], "needs-more")
        self.assertTrue(
            self.store.add_upload("aube-structure", "same.pdf", b"<html>please login</html>")[
                "duplicate"
            ]
        )
        self.assertEqual(len(self.store.history("gaps", g["id"])), 2)

    def pdf(self):
        from pypdf import PdfWriter

        p = PdfWriter()
        p.add_blank_page(width=100, height=100)
        b = io.BytesIO()
        p.write(b)
        return b.getvalue()

    def review_bundle(self):
        u = self.store.add_upload("aube-structure", "fixture.pdf", self.pdf())["upload"]
        e = copy.deepcopy(
            next(x for x in self.initial["evidence"] if x["id"] == "aube-preclinical")
        )
        e.update(
            id="fixture-evidence", summary="Test-only simulated review; never enters delivered data"
        )
        g = copy.deepcopy(next(x for x in self.initial["gaps"] if x["id"] == "aube-structure"))
        g.update(status="resolved", resolution="Test-only supported fixture")
        review = dict(
            id="fixture-review",
            gapId=g["id"],
            uploadId=u["id"],
            sha256=u["sha256"],
            sourceId="aube-aacr",
            identity="verified",
            scientific="supports",
            reviewer="Test",
            note="Isolated test fixture, not actual scientific review",
            version="test-v1",
            evidenceIds=[e["id"]],
        )
        return u, {"reviews": [review], "evidence": [e], "gaps": [g]}

    def test_format_does_not_automatically_resolve_science(self):
        u, b = self.review_bundle()
        s = self.store.state()
        self.assertEqual(u["formatCheck"]["status"], "passed")
        self.assertEqual(s["reviews"], [])
        g = next(x for x in s["gaps"] if x["id"] == "aube-structure")
        self.assertEqual(g["status"], "submitted")
        with self.assertRaises(Invalid):
            self.patch({"gaps": b["gaps"]})
        b["reviews"][0]["identity"] = "mismatch"
        with self.assertRaises(Invalid):
            self.patch(b)
        self.assertEqual(self.store.state()["reviews"], [])

    def test_review_and_fact_resolution_atomic(self):
        u, b = self.review_bundle()
        result = self.patch(b)
        self.assertEqual(len(result["changed"]), 3)
        s = self.store.state()
        self.assertEqual(
            next(g for g in s["gaps"] if g["id"] == "aube-structure")["status"], "resolved"
        )
        self.assertEqual(len(s["reviews"]), 1)
        self.assertEqual(
            self.store.packet("aube-structure")["uploads"][0]["sha256"],
            hashlib.sha256(self.pdf()).hexdigest(),
        )

    def test_new_conflict_requires_reopening_gap(self):
        u, b = self.review_bundle()
        self.patch(b)
        conflict = dict(
            b["reviews"][0],
            id="conflicting-review",
            scientific="conflict",
            note="New contradictory reading in isolated fixture",
        )
        with self.assertRaisesRegex(Invalid, "冲突"):
            self.patch({"reviews": [conflict]})
        g = dict(b["gaps"][0], status="needs-more", resolution="先保留冲突，继续核查")
        self.patch({"reviews": [conflict], "gaps": [g]})
        self.assertEqual(
            next(x for x in self.store.state()["gaps"] if x["id"] == g["id"])["status"],
            "needs-more",
        )

    def test_tampered_file_and_unrelated_evidence_rejected(self):
        u, b = self.review_bundle()
        b["evidence"][0]["moleculeIds"] = ["luna18"]
        with self.assertRaisesRegex(Invalid, "不相关"):
            self.patch(b)
        b["evidence"][0]["moleculeIds"] = ["aube00"]
        (self.store.root / "uploads" / u["sha256"]).write_bytes(b"changed")
        with self.assertRaisesRegex(Invalid, "内容改变"):
            self.patch(b)

    def test_archive_reason_history_and_duplicate_suppression(self):
        g = copy.deepcopy(next(x for x in self.initial["gaps"] if x["id"] == "aube-structure"))
        g.update(status="unobtainable", resolution="人工查过机构入口仍无法获取")
        self.patch({"gaps": [g]})
        self.assertEqual(self.store.packet(g["id"])["gap"]["status"], "unobtainable")
        self.assertEqual(
            self.store.history("gaps", g["id"])[0]["after"]["resolution"], g["resolution"]
        )
        new = dict(g, id="duplicate-unavailable", status="needs-material", reasonType="acquisition")
        with self.assertRaisesRegex(Invalid, "已有无法获取"):
            self.patch({"gaps": [new]})
        with self.assertRaisesRegex(Invalid, "归档须"):
            self.patch({"gaps": [dict(g, resolution="")]})
        with self.assertRaisesRegex(Invalid, "已关闭"):
            self.store.add_upload(g["id"], "test.pdf", b"fake")

    def test_public_evidence_can_resolve_without_upload(self):
        g = copy.deepcopy(next(x for x in self.initial["gaps"] if x["id"] == "aube-structure"))
        e = copy.deepcopy(
            next(x for x in self.initial["evidence"] if x["id"] == "aube-preclinical")
        )
        g.update(
            status="resolved",
            resolution="用户提供公开可读正文，核实相关段落",
            resolutionEvidenceIds=[e["id"]],
        )
        g["sourceIds"] = list(set(g["sourceIds"] + [e["sourceId"]]))
        self.patch({"gaps": [g]})
        self.assertEqual(self.store.packet(g["id"])["gap"]["status"], "resolved")
        e["verification"] = "candidate"
        with self.assertRaises(Invalid):
            self.patch({"evidence": [e]})


class HTTPTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Store(self.tmp.name)

        class IsolatedHandler(Handler):
            pass

        IsolatedHandler.store = self.store
        self.http = ThreadingHTTPServer(("127.0.0.1", 0), IsolatedHandler)
        self.thread = threading.Thread(target=self.http.serve_forever, daemon=True)
        self.thread.start()
        self.base = "http://127.0.0.1:" + str(self.http.server_port)

    def tearDown(self):
        self.http.shutdown()
        self.http.server_close()
        self.thread.join()
        self.tmp.cleanup()

    def request(self, path, body=None, headers={}):
        req = urllib.request.Request(self.base + path, data=body, headers=headers)
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status, json.load(r)

    def test_rejects_dns_rebinding_and_cross_site_reads(self):
        for headers in (
            {"Host": "attacker.example"},
            {"Host": "127.0.0.1.attacker.example"},
            {"Sec-Fetch-Site": "cross-site"},
        ):
            with self.subTest(headers=headers):
                self.assertEqual(self.direct_status("GET", "/api/state", headers), 403)
        self.assertEqual(self.request("/api/state")[0], 200)

    def direct_status(self, method, path, headers=None, body=None):
        # Direct socket: environment HTTP proxies must not handle forged-Host test requests.
        connection = HTTPConnection("127.0.0.1", self.http.server_port, timeout=5)
        try:
            connection.request(method, path, body=body, headers=headers or {})
            response = connection.getresponse()
            response.read()
            return response.status
        finally:
            connection.close()

    def test_rejects_foreign_host_writes_and_static_path_escape(self):
        self.assertEqual(
            self.direct_status(
                "POST",
                "/api/commit",
                {"Host": "attacker.example", "X-Atlas-Client": "workbench"},
                b"{}",
            ),
            403,
        )
        with self.assertRaises(urllib.error.HTTPError) as response:
            self.request("/%2e%2e/atlas.py")
        self.assertEqual(response.exception.code, 403)
        with urllib.request.urlopen(self.base + "/api/health") as response:
            self.assertEqual(response.headers["Cache-Control"], "no-store")
            self.assertEqual(response.headers["X-Frame-Options"], "DENY")

    def test_read_mutation_guard_conflict_upload_and_packet(self):
        self.assertEqual(self.request("/api/health")[1]["jev"], "not-configured")
        r = self.request("/api/state")[1]["revision"]
        body = json.dumps(
            {
                "baseRevision": r,
                "reviewer": "Test",
                "records": {"targets": [{"id": "http-test", "name": "Isolated HTTP target"}]},
            }
        ).encode()
        with self.assertRaises(urllib.error.HTTPError) as e:
            self.request("/api/commit", body)
        self.assertEqual(e.exception.code, 403)
        with self.assertRaises(urllib.error.HTTPError):
            self.request(
                "/api/commit",
                body,
                {"X-Atlas-Client": "workbench", "Origin": "https://malicious.example"},
            )
        self.assertEqual(
            self.request("/api/commit", body, {"X-Atlas-Client": "workbench"})[1]["revision"], r + 1
        )
        with self.assertRaises(urllib.error.HTTPError) as e:
            self.request("/api/commit", body, {"X-Atlas-Client": "workbench"})
        self.assertEqual(e.exception.code, 409)
        status, response = self.request(
            "/api/gaps/aube-structure/uploads?name=login.pdf",
            b"<html>login</html>",
            {"X-Atlas-Client": "workbench"},
        )
        self.assertEqual(status, 201)
        self.assertEqual(response["upload"]["formatCheck"]["status"], "rejected")
        self.assertEqual(len(self.request("/api/gaps/aube-structure/packet")[1]["uploads"]), 1)


if __name__ == "__main__":
    unittest.main()

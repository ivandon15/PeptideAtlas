import copy
import json
import tempfile
import unittest

from server.publication import public_snapshot
from server.store import Store, Invalid


class PublicExportTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Store(self.tmp.name)
        self.state = self.store.state()
        self.baseline = {
            key: copy.deepcopy(value)
            for key, value in self.state.items()
            if isinstance(value, list)
        }

    def tearDown(self):
        self.tmp.cleanup()

    def snapshot(self, state=None, observations=()):
        return public_snapshot(state or self.state, observations, self.baseline)

    def test_allowlist_drops_private_fields_and_out_of_scope_records(self):
        self.state["targets"][0]["internalNote"] = "never export"
        self.state["targets"].append({"id": "private-project", "name": "Private project"})
        self.state["uploads"] = [{"name": "private.pdf"}]
        self.state["receipts"] = [{"query": "private query"}]
        snapshot = self.snapshot()
        body = json.dumps(snapshot)
        for forbidden in (
            "internalNote",
            "private-project",
            "private.pdf",
            "private query",
            "lastCommitAt",
            "basedOnRevision",
        ):
            self.assertNotIn(forbidden, body)
        self.assertEqual(self.store.state()["revision"], 1)

    def test_money_nested_fields_and_gap_history_are_not_copied(self):
        self.state["deals"][0]["rationale"]["internalNote"] = "never export"
        self.state["gaps"][0].update(status="unobtainable", resolution="private reason")
        body = json.dumps(self.snapshot())
        self.assertNotIn("internalNote", body)
        self.assertNotIn("private reason", body)
        self.assertNotIn(
            self.state["gaps"][0]["id"], json.dumps(self.snapshot()["records"]["gaps"])
        )

    def test_private_strings_stop_export_without_echoing_sensitive_value(self):
        for value in (
            "/Users/example/private/notes",
            r"C:\Users\Example\notes",
            "person@example.com",
            "我司的内部会议",
        ):
            self.state["targets"][0]["description"] = value
            with self.subTest(value=value), self.assertRaises(Invalid) as error:
                self.snapshot()
            self.assertNotIn(value, str(error.exception))

    def test_unpublished_reference_stops_export_instead_of_expanding_scope(self):
        self.state["molecules"][0]["sourceIds"].append("private-source")
        with self.assertRaisesRegex(Invalid, "公开范围缺少关联"):
            self.snapshot()

    def test_only_explicit_active_observations_and_no_author_or_local_revision(self):
        source = self.state["sources"][0]["id"]
        observation = dict(
            id="public-test",
            title="Test",
            asOf="2026-10-27",
            author="Private reviewer",
            basedOnRevision=75,
            coverage="Public sources",
            summary="Public finding",
            interpretation="Hypothesis",
            uncertainty="Limits",
            nextCheck="Next",
            status="active",
            sourceIds=[source],
            evidenceIds=[],
            dealIds=[],
        )
        self.state["observations"] = [observation]
        self.assertFalse(self.snapshot()["records"]["observations"])
        public = self.snapshot(observations=["public-test"])["records"]["observations"][0]
        self.assertNotIn("author", public)
        self.assertNotIn("basedOnRevision", public)
        observation["status"] = "needs-review"
        with self.assertRaisesRegex(Invalid, "不能公开"):
            self.snapshot(observations=["public-test"])


if __name__ == "__main__":
    unittest.main()

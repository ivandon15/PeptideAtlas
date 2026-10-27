import tempfile
import unittest

from package_source import ROOT
from server.editorial import UNWANTED, violations
from server.store import Store, Invalid
from server.publication import check_public_text


class EditorialTests(unittest.TestCase):
    def test_commit_and_publication_reject_process_copy(self):
        bad = {"targets": [{"id": "test", "name": "Test", "description": "本轮补录靶点"}]}
        with tempfile.TemporaryDirectory() as folder:
            store = Store(folder, seed=False)
            with self.assertRaisesRegex(Invalid, "展示文案"):
                store.commit({"baseRevision": 0, "reviewer": "Test", "records": bad})
            self.assertEqual(store.state()["revision"], 0)
        with self.assertRaisesRegex(Invalid, "展示文案"):
            check_public_text(bad)

    def test_facts_uncertainty_and_private_history_remain_valid(self):
        self.assertFalse(
            violations(
                {
                    "evidence": [
                        {
                            "id": "trial",
                            "summary": "450mg未达主要终点；未检出结合；实际支付未披露。",
                        }
                    ],
                    "receipts": [{"id": "log", "note": "本轮检索未完成"}],
                    "gaps": [
                        {"id": "archived", "status": "unobtainable", "reason": "本轮无法获取"}
                    ],
                }
            )
        )
        self.assertTrue(violations({"deals": [{"id": "deal", "description": "不是收购公司"}]}))

    def test_web_copy_avoids_stock_defensive_explanations(self):
        for path in (ROOT / "src").glob("*.tsx"):
            self.assertIsNone(UNWANTED.search(path.read_text()), path.name)


if __name__ == "__main__":
    unittest.main()

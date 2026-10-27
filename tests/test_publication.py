"""Check the public boundary without opening the user's runtime database."""

import json
from pathlib import Path
import re
import tempfile
import unittest
import zipfile

from package_source import ROOT, package, source_paths
from server.store import Store


class PublicationTests(unittest.TestCase):
    def test_public_seed_is_valid_without_private_workflow_state(self):
        seed = json.loads((ROOT / "data/pilot.json").read_text(encoding="utf-8"))
        for kind in ("receipts", "reviews", "observations", "uploads"):
            self.assertFalse(seed.get(kind), f"{kind} belongs in a private runtime")
        serialized = json.dumps(seed, ensure_ascii=False)
        self.assertNotRegex(serialized, r"/(Users|home)/[^/\s]+/|[A-Z]:\\\\Users\\\\")

        def walk(value):
            if isinstance(value, dict):
                forbidden = {"localPath", "rawFile", "firstPageText", "submittedAt", "sha256"}
                self.assertFalse(forbidden.intersection(value), "private material metadata in seed")
                for item in value.values():
                    walk(item)
            elif isinstance(value, list):
                for item in value:
                    walk(item)

        walk(seed)
        with tempfile.TemporaryDirectory() as folder:
            store = Store(folder, seed=False)
            store.commit(
                {"baseRevision": 0, "reviewer": "Public seed CI validation", "records": seed}
            )
            self.assertEqual(store.state()["revision"], 1)

    def test_source_package_excludes_runtime_and_includes_contributor_entries(self):
        paths = {p.relative_to(ROOT).as_posix() for p in source_paths()}
        for name in (
            "CONTRIBUTING.md",
            "AGENTS.md",
            ".github/workflows/ci.yml",
            "scripts/check.mjs",
        ):
            self.assertIn(name, paths)
        for name in paths:
            self.assertNotIn(name.split("/")[0], {".data", ".git", "node_modules", "dist", ".venv"})
            self.assertNotIn(Path(name).suffix, {".pdf", ".xlsx", ".sqlite3", ".zip"})
        with tempfile.TemporaryDirectory() as folder:
            archive = package(Path(folder) / "source.zip")
            with zipfile.ZipFile(archive) as z:
                self.assertEqual(set(z.namelist()), {"peptide-atlas/" + p for p in paths})

    def test_portable_documentation_links_exist(self):
        paths = [
            ROOT / "README.md",
            ROOT / "AGENTS.md",
            ROOT / "CONTRIBUTING.md",
            ROOT / "ACCEPTANCE.md",
        ]
        paths.extend((ROOT / ".agents").rglob("*.md"))
        paths.extend((ROOT / "docs").glob("*.md"))
        for path in paths:
            for target in re.findall(r"!?\[[^\]]*\]\(([^)]+)\)", path.read_text(encoding="utf-8")):
                if "://" in target or target.startswith("#"):
                    continue
                target = target.split("#", 1)[0]
                self.assertTrue((path.parent / target).is_file(), f"{path.name}: {target}")


if __name__ == "__main__":
    unittest.main()

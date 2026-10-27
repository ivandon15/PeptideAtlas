"""Build a source archive from an explicit public allowlist, never the runtime directory."""

from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent
FILES = (
    "ACCEPTANCE.md",
    "AGENTS.md",
    "README.md",
    "CONTRIBUTING.md",
    "SECURITY.md",
    "LICENSE",
    "atlas.py",
    "package_source.py",
    "package.json",
    "package-lock.json",
    "requirements.txt",
    "run.mjs",
    "tsconfig.json",
    "vite.config.ts",
    "index.html",
    ".gitignore",
    ".editorconfig",
)
FOLDERS = ("src", "server", "tests", "data", ".agents", "docs", ".github", "scripts")
SUFFIXES = {".py", ".ts", ".tsx", ".css", ".mjs", ".json", ".md", ".yml", ".yaml", ".png", ".jpg", ".svg"}


def source_paths():
    paths = [ROOT / name for name in FILES]
    for folder in FOLDERS:
        paths.extend(
            p
            for p in (ROOT / folder).rglob("*")
            if p.is_file()
            and not p.is_symlink()
            and "__pycache__" not in p.parts
            and p.suffix in SUFFIXES
        )
    for path in paths:
        if not path.is_file():
            raise FileNotFoundError(path)
    return sorted(paths)


def package(output=None):
    output = Path(output) if output else ROOT / "release" / "peptide-atlas-source.zip"
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in source_paths():
            archive.write(path, "peptide-atlas/" + path.relative_to(ROOT).as_posix())
    return output


if __name__ == "__main__":
    print(package())

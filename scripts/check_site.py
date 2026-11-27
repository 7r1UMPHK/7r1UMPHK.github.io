from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"

REQUIRED = [
    "config.json",
    "static/about.html",
    "static/link.html",
    "static/css/pages.css",
    "static/css/theme.css",
    "static/plugins/theme.js",
    "docs/index.html",
    "docs/about.html",
    "docs/link.html",
    "docs/tag.html",
    "docs/css/theme.css",
    "docs/css/pages.css",
    "docs/plugins/theme.js",
]

MARKER_PATTERNS = ("<<<<<<<", "=======", ">>>>>>>")

def fail(msg: str) -> None:
    print(f"[check] FAIL: {msg}", file=sys.stderr)
    raise SystemExit(1)

def main() -> None:
    for rel in REQUIRED:
        path = ROOT / rel
        if not path.exists():
            fail(f"missing {rel}")
        if path.is_file() and path.stat().st_size == 0:
            fail(f"empty {rel}")

    tag_html = (DOCS / "tag.html").read_text(encoding="utf-8", errors="ignore")
    if "/css/theme.css" not in tag_html:
        fail("docs/tag.html does not load /css/theme.css (run scripts/postbuild.py)")

    source_roots = [ROOT / "static", ROOT / "scripts", ROOT / ".github", ROOT / "config.json"]
    for root in source_roots:
        paths = [root] if root.is_file() else root.rglob("*")
        for path in paths:
            if not path.is_file():
                continue
            if path.suffix.lower() in {".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".woff", ".woff2", ".ttf", ".pdf"}:
                continue
            text = path.read_text(encoding="utf-8", errors="ignore")
            for line in text.splitlines():
                stripped = line.rstrip()
                if stripped.startswith("<<<<<<< ") or stripped == "=======" or stripped.startswith(">>>>>>> "):
                    fail(f"conflict marker in {path.relative_to(ROOT)}: {line[:40]!r}")

    print("[check] OK")

if __name__ == "__main__":
    main()

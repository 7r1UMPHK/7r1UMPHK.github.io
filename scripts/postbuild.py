from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"

PRIMER_REL = "/css/primer.css"
THEME_LINK = "<link href='/css/theme.css' rel='stylesheet'>"
ASSET_REPLACEMENTS = {
    "https://7r1UMPHK.github.io/plugins/theme.js": "/plugins/theme.js",
    "https://7r1UMPHK.github.io/plugins/count.js": "/plugins/count.js",
    "https://7r1UMPHK.github.io/css/primer.css": "/css/primer.css",
}

def patch_page(path: Path) -> bool:
    text = path.read_text(encoding="utf-8", errors="ignore")
    original = text

    for old, new in ASSET_REPLACEMENTS.items():
        text = text.replace(old, new)

    if "/css/theme.css" not in text and "</head>" in text:
        if PRIMER_REL in text:
            text = text.replace(
                f"<link href='{PRIMER_REL}' rel='stylesheet' />",
                f"<link href='{PRIMER_REL}' rel='stylesheet' />\n{THEME_LINK}",
                1,
            )
        else:
            text = text.replace("</head>", f"    {THEME_LINK}\n</head>", 1)

    if text != original:
        with path.open("w", encoding="utf-8", newline="\n") as fh:
            fh.write(text)
        return True
    return False

def main() -> None:
    if not DOCS.is_dir():
        print(f"[postbuild] skip: {DOCS} not found", file=sys.stderr)
        return

    changed = []
    for path in sorted(DOCS.glob("*.html")):
        if patch_page(path):
            changed.append(path.name)

    if changed:
        print("[postbuild] patched:", ", ".join(changed))
    else:
        print("[postbuild] nothing to patch")

if __name__ == "__main__":
    main()

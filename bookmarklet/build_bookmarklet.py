#!/usr/bin/env python3
"""Build the ChatGPT Browser Pruner bookmarklet URL."""

from pathlib import Path
from urllib.parse import quote


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "pruner-bookmarklet.js"
OUTPUT = ROOT / "bookmarklet.txt"


def main() -> None:
    source = SOURCE.read_text(encoding="utf-8").strip()
    OUTPUT.write_text("javascript:" + quote(source, safe=""), encoding="utf-8")


if __name__ == "__main__":
    main()

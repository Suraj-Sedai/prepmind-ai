import re
from pathlib import Path


def sanitize_filename(filename: str, fallback_stem: str = "document") -> str:
    path = Path(filename)
    stem = re.sub(r"[^A-Za-z0-9._-]+", "-", path.stem).strip("-._")
    suffix = re.sub(r"[^A-Za-z0-9.]+", "", path.suffix.lower())

    if not stem:
        stem = fallback_stem

    return f"{stem[:80]}{suffix[:10]}"

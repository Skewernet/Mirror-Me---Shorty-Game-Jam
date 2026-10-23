#!/usr/bin/env python3
"""Check local asset credit coverage and publication-document consistency.

Run from any directory: python3 tools/check_credits.py
Uses only the Python standard library and makes no network requests.
"""
from __future__ import annotations

import argparse
from datetime import date
import json
from pathlib import Path, PurePosixPath
import sys
from urllib.parse import urlparse


REQUIRED_FIELDS = {"id", "title", "creator", "license", "source", "licenseUrl", "files", "changes"}
# Include video/font formats as well, so later additions need their own credit.
MEDIA_SUFFIXES = {
    ".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".svg", ".ico",
    ".bmp", ".tif", ".tiff", ".hdr", ".exr", ".ktx", ".ktx2", ".basis",
    ".ogg", ".wav", ".mp3", ".m4a", ".aac", ".flac", ".opus",
    ".webm", ".mp4", ".glb", ".gltf", ".bin", ".obj", ".mtl", ".fbx",
    ".dae", ".ply", ".stl", ".usdz", ".usd", ".blend",
    ".woff", ".woff2", ".ttf", ".otf",
}
DOCUMENTS = ("ATTRIBUTIONS.md", "GAME_DESCRIPTION.md")


def normalized(text: str) -> str:
    """Allow ordinary Markdown line wrapping without weakening exact names/URLs."""
    return " ".join(text.split())


def check(root: Path) -> list[str]:
    errors: list[str] = []
    register = root / "assets/credits.json"
    try:
        data = json.loads(register.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        return [f"Cannot read assets/credits.json: {exc}"]
    if not isinstance(data, dict):
        return ["assets/credits.json must contain a JSON object."]
    if not isinstance(data.get("title"), str) or not data["title"].strip():
        errors.append("Register title must be a non-empty string.")
    try:
        date.fromisoformat(data.get("updated", ""))
    except (TypeError, ValueError):
        errors.append("Register updated must be an ISO date (YYYY-MM-DD).")
    entries = data.get("entries")
    if not isinstance(entries, list) or not entries:
        return errors + ["Register entries must be a non-empty array."]

    documents: dict[str, str] = {}
    for name in DOCUMENTS:
        try:
            documents[name] = normalized((root / name).read_text(encoding="utf-8"))
        except (OSError, UnicodeError) as exc:
            errors.append(f"Cannot read {name}: {exc}")

    seen_ids: set[str] = set()
    covered: set[str] = set()
    for index, entry in enumerate(entries):
        label = f"Entry {index + 1}"
        if not isinstance(entry, dict):
            errors.append(f"{label} must be an object.")
            continue
        if isinstance(entry.get("id"), str) and entry["id"].strip():
            label += f" ({entry['id']})"
            if entry["id"] in seen_ids:
                errors.append(f"{label}: duplicate id.")
            seen_ids.add(entry["id"])
        missing = REQUIRED_FIELDS - entry.keys()
        if missing:
            errors.append(f"{label}: missing fields: {', '.join(sorted(missing))}.")
        for field in sorted(REQUIRED_FIELDS - {"files"}):
            value = entry.get(field)
            # Original project work correctly has no invented license URL.
            if not isinstance(value, str) or (field != "licenseUrl" and not value.strip()):
                errors.append(f"{label}: {field} must be a {'string' if field == 'licenseUrl' else 'non-empty string'}.")
        for field in ("source", "licenseUrl"):
            value = entry.get(field)
            if isinstance(value, str) and value:
                try:
                    parsed = urlparse(value)
                    valid = parsed.scheme in {"http", "https"} and bool(parsed.netloc)
                except ValueError:
                    valid = False
                if not valid:
                    errors.append(f"{label}: {field} must be an HTTP(S) URL, got {value!r}.")

        patterns = entry.get("files")
        if not isinstance(patterns, list) or not patterns:
            errors.append(f"{label}: files must be a non-empty array of relative paths/globs.")
        else:
            for pattern in patterns:
                if not isinstance(pattern, str) or not pattern.strip():
                    errors.append(f"{label}: files contains an invalid path/glob: {pattern!r}.")
                    continue
                if PurePosixPath(pattern).is_absolute() or ".." in PurePosixPath(pattern).parts or "\\" in pattern:
                    errors.append(f"{label}: use repository-relative forward-slash paths: {pattern!r}.")
                    continue
                # pathlib's trailing '/**' matches directories; credit registers
                # use it conventionally to mean all descendant files.
                glob = pattern + "/*" if pattern.endswith("/**") else pattern
                try:
                    matches = [p for p in root.glob(glob) if p.is_file()]
                except (ValueError, OSError) as exc:
                    errors.append(f"{label}: invalid file glob {pattern!r}: {exc}.")
                    continue
                if not matches:
                    errors.append(f"{label}: file pattern {pattern!r} matches no files; fix or remove the stale credit.")
                covered.update(p.relative_to(root).as_posix() for p in matches)

        for document, text in documents.items():
            for field in ("title", "creator", "source", "license", "licenseUrl"):
                value = entry.get(field)
                if isinstance(value, str) and value and normalized(value) not in text:
                    errors.append(f"{label}: {document} is missing {field} {value!r}; synchronize it with assets/credits.json.")

    assets = root / "assets"
    media = sorted(p for p in assets.rglob("*") if p.is_file() and p.suffix.lower() in MEDIA_SUFFIXES)
    vendor = root / "vendor"
    modules = sorted(p for p in vendor.rglob("*") if p.is_file() and p.suffix.lower() in {".js", ".mjs", ".cjs"})
    for path in media + modules:
        name = path.relative_to(root).as_posix()
        if name not in covered:
            errors.append(f"Uncredited shipped asset: {name}. Add a creator/source/license entry and synchronize both documents.")
    if not errors:
        print(f"Credits verified: {len(entries)} entries, {len(media)} media/model assets, {len(modules)} vendor modules; both documents synchronized.")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1], help="Repository to check (default: this checkout).")
    args = parser.parse_args()
    errors = check(args.root.resolve())
    if errors:
        print(f"Credits check failed ({len(errors)} issue{'s' if len(errors) != 1 else ''}):", file=sys.stderr)
        for error in errors:
            print("- " + error, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

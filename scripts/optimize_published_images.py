#!/usr/bin/env python3
"""Resize legacy JPEGs in a generated Jekyll site, never in the source tree."""

import concurrent.futures
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LONG_EDGE = 2560
MAX_SITE_BYTES = 800 * 1024 * 1024


def optimize(path):
    result = subprocess.run(
        ["sips", "-g", "pixelWidth", "-g", "pixelHeight", str(path)],
        check=True, capture_output=True, text=True,
    )
    dimensions = re.findall(r"pixel(?:Width|Height):\s*(\d+)", result.stdout)
    if len(dimensions) != 2:
        raise RuntimeError(f"Could not read JPEG dimensions: {path}")
    if max(map(int, dimensions)) <= LONG_EDGE:
        return False

    fd, name = tempfile.mkstemp(dir=path.parent, suffix=".jpg")
    os.close(fd)
    temporary = Path(name)
    try:
        subprocess.run(
            ["sips", "-Z", str(LONG_EDGE), "-s", "format", "jpeg",
             "-s", "formatOptions", "93", str(path), "--out", str(temporary)],
            check=True, capture_output=True, text=True,
        )
        if temporary.stat().st_size == 0:
            raise RuntimeError(f"Empty optimized JPEG: {path}")
        temporary.chmod(path.stat().st_mode & 0o777)
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)
    return True


def strip_metadata(images, exiftool):
    paths = [p for p in images.rglob("*")
             if p.is_file() and p.suffix.lower() in (".jpg", ".jpeg", ".png", ".avif")]
    if not paths:
        raise RuntimeError("No published images found for metadata cleanup")

    with tempfile.TemporaryDirectory(dir=images.parent) as directory:
        replacements = []
        inputs = []
        for path in paths:
            with path.open("rb") as image:
                is_png = image.read(8) == b"\x89PNG\r\n\x1a\n"
            if is_png and path.suffix.lower() != ".png":
                temporary = Path(directory) / f"{len(replacements)}.png"
                shutil.copy2(path, temporary)
                replacements.append((temporary, path))
                inputs.append(temporary)
            else:
                inputs.append(path)

        input_names = [str(path) for path in inputs]
        subprocess.run(
            [exiftool, "-overwrite_original", "-all=", "--ICC_Profile:all",
             "-tagsFromFile", "@", "-Orientation", "-ColorSpaceTags",
             "-Copyright", "-Creator", "-Rights", "-Credit",
             *input_names],
            check=True,
        )
        result = subprocess.run(
            [exiftool, "-json", "-GPS*", "-Serial*", "-BodySerialNumber",
             "-CameraSerialNumber", "-InternalSerialNumber", "-LensSerialNumber",
             "-OwnerName", "-CameraOwnerName", "-CreatorContactInfo", *input_names],
            check=True, stdout=subprocess.PIPE, text=True,
        )
        metadata = json.loads(result.stdout)
        if {item["SourceFile"] for item in metadata} != set(input_names):
            raise RuntimeError("Could not verify metadata for every published image")
        for item in metadata:
            tags = [key for key in item if key != "SourceFile"]
            if tags:
                raise RuntimeError(f"Private metadata remains in {item['SourceFile']}: "
                                   f"{', '.join(tags)}")
        for temporary, path in replacements:
            temporary.replace(path)

    return len(paths)


def main():
    if len(sys.argv) != 2:
        raise RuntimeError("Usage: python3 scripts/optimize_published_images.py SITE_DIRECTORY")
    site = Path(sys.argv[1]).resolve()
    images = site / "images"
    if not (site / "photography" / "index.html").is_file() or not images.is_dir():
        raise RuntimeError(f"Not a generated site: {site}")
    if images.resolve() == (ROOT / "images").resolve() or (images / "Photographs").exists():
        raise RuntimeError("Refusing to process source images or publish Photography originals")

    originals = [p for p in images.iterdir() if p.is_file() and p.suffix.lower() in (".jpg", ".jpeg")]
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        resized = sum(executor.map(optimize, originals))

    cleaned = strip_metadata(images, os.environ.get("EXIFTOOL", "exiftool"))
    total = sum(p.stat().st_size for p in site.rglob("*") if p.is_file())
    print(f"Optimized {resized} legacy JPEGs and cleaned metadata from {cleaned} images; "
          f"published site: {total / 1024**2:.1f} MiB")
    if total > MAX_SITE_BYTES:
        raise RuntimeError(f"Published site exceeds the {MAX_SITE_BYTES // 1024**2} MiB safety limit")


if __name__ == "__main__":
    try:
        main()
    except (OSError, RuntimeError, subprocess.CalledProcessError) as error:
        print(f"Published-image optimization failed: {error}", file=sys.stderr)
        sys.exit(1)

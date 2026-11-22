#!/usr/bin/env python3
"""Resize legacy JPEGs in a generated Jekyll site, never in the source tree."""

import concurrent.futures
import os
import re
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

    total = sum(p.stat().st_size for p in site.rglob("*") if p.is_file())
    print(f"Optimized {resized} legacy JPEGs; published site: {total / 1024**2:.1f} MiB")
    if total > MAX_SITE_BYTES:
        raise RuntimeError(f"Published site exceeds the {MAX_SITE_BYTES // 1024**2} MiB safety limit")


if __name__ == "__main__":
    try:
        main()
    except (OSError, RuntimeError, subprocess.CalledProcessError) as error:
        print(f"Published-image optimization failed: {error}", file=sys.stderr)
        sys.exit(1)

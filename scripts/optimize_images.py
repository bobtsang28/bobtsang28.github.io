#!/usr/bin/env python3
"""Generate responsive image variants for the portfolio."""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
VARIANT_ROOT = ROOT / "images" / "optimized"
MANIFEST_PATH = ROOT / "_data" / "image_variants.yml"
PHOTOGRAPHY_MANIFEST_PATH = ROOT / "_data" / "photography_variants.yml"
FOOTER_MANIFEST_PATH = ROOT / "_data" / "footer_gallery_variants.yml"

COVER_WIDTHS = (400, 640, 800, 1280, 2000)
GALLERY_WIDTHS = (400, 800, 1600)
GALLERY_LONG_EDGE = 2560
WIDE_GALLERY_WIDTHS = (400, 800, 1280, 1600, 2000)
STILL_WIDTHS = (400, 800)
PORTRAIT_WIDTHS = (400, 800, 1600)
FOOTER_WIDTHS = (400, 800)
LAUREL_WIDTHS = (400,)

IMAGE_REFERENCE = re.compile(r"""(/images/[^"'()\s]+?\.(?:jpe?g|png))""", re.IGNORECASE)


def add_references(assets, references, widths, output_format):
    for reference in references:
        source = ROOT / reference.lstrip("/")
        if not source.is_file():
            raise RuntimeError(f"Referenced image does not exist: {reference}")
        asset = assets.setdefault(reference, {"avif": set(), "png": set(), "jpeg": set()})
        asset[output_format].update(widths)


def references_matching(text, pattern):
    return re.findall(pattern, text, re.IGNORECASE | re.MULTILINE)


def footer_references():
    settings = (ROOT / "_data" / "settings.yml").read_text(encoding="utf-8")
    gallery = re.search(r"(?ms)^gallery:\s*\n(.*?)(?=^\S|\Z)", settings)
    if not gallery:
        raise RuntimeError("Footer gallery is missing from settings.yml")
    references = references_matching(
        gallery.group(1), r"""^\s*url:\s*['"]?(/images/[^'"\s]+?\.(?:jpe?g|png))"""
    )
    if not references:
        raise RuntimeError("Footer gallery contains no image references")
    return references


def collect_assets(photography_only=False, footer_only=False):
    assets = {}

    if not photography_only:
        footer_images = footer_references()
        add_references(assets, footer_images, FOOTER_WIDTHS, "avif")
        add_references(assets, footer_images, FOOTER_WIDTHS, "jpeg")
        if footer_only:
            return assets

    for project_path in (() if photography_only else sorted((ROOT / "_projects").glob("*.md"))):
        text = project_path.read_text(encoding="utf-8")
        covers = references_matching(
            text, r"""^image:\s*['"]?(/images/[^'"\s]+?\.(?:jpe?g|png))"""
        )
        stills = references_matching(
            text,
            r"""(?:<img\b[^>]*\bsrc=|responsive-image\.html\s+src=)['"](/images/[^'"]+?\.(?:jpe?g|png))""",
        )
        add_references(assets, covers, COVER_WIDTHS, "avif")
        add_references(assets, stills, STILL_WIDTHS, "avif")

    photography_text = (ROOT / "_data" / "photography_gallery.yml").read_text(
        encoding="utf-8"
    )
    photography_entries = re.finditer(
        r"""(?ms)^-\s*image:\s*['"]?([^'"\n]+).*?(?=^-\s*image:|\Z)""",
        photography_text,
    )
    for entry in photography_entries:
        reference = entry.group(1).strip()
        if photography_only and not reference.startswith("/images/Photographs/"):
            raise RuntimeError(f"Photography source must be in /images/Photographs/: {reference}")
        widths = (
            (400, 800)
            if reference.startswith("/images/Photographs/")
            else WIDE_GALLERY_WIDTHS
            if re.search(r"^\s+wide:\s*true\s*$", entry.group(0), re.MULTILINE)
            else GALLERY_WIDTHS
        )
        add_references(assets, [reference], widths, "avif")
        if reference.startswith("/images/Photographs/"):
            add_references(assets, [reference], (400, 800), "jpeg")

    if photography_only:
        return assets

    settings_text = (ROOT / "_data" / "settings.yml").read_text(encoding="utf-8")
    avatar = references_matching(
        settings_text, r"""author__avatar:\s*['"]?(/images/[^'"\s]+?\.(?:jpe?g|png))"""
    )
    add_references(assets, avatar, FOOTER_WIDTHS, "avif")

    about_text = (ROOT / "_pages" / "about.md").read_text(encoding="utf-8")
    about_images = references_matching(
        about_text, r"""^image:\s*['"]?(/images/[^'"\s]+?\.(?:jpe?g|png))"""
    )
    add_references(assets, about_images, PORTRAIT_WIDTHS, "avif")

    intro_text = (ROOT / "_includes" / "section-intro.html").read_text(
        encoding="utf-8"
    )
    laurels = IMAGE_REFERENCE.findall(intro_text)
    add_references(assets, laurels, LAUREL_WIDTHS, "png")

    return assets


def image_dimensions(path):
    result = subprocess.run(
        ["sips", "-g", "pixelWidth", "-g", "pixelHeight", str(path)],
        check=True,
        capture_output=True,
        text=True,
    )
    width = re.search(r"pixelWidth:\s*(\d+)", result.stdout)
    height = re.search(r"pixelHeight:\s*(\d+)", result.stdout)
    if not width or not height:
        raise RuntimeError(f"Could not read image dimensions: {path}")
    return int(width.group(1)), int(height.group(1))


def variant_path(reference, width, output_format):
    filename = Path(reference).name
    return VARIANT_ROOT / f"{filename}.{width}.{output_format}"


def make_variant(source, target, width, height, output_format, force, dry_run):
    if target.is_file() and not force:
        return "skipped"
    if dry_run:
        return "planned"

    target.parent.mkdir(parents=True, exist_ok=True)
    command = ["sips", "-z", str(height), str(width)]
    if output_format == "avif":
        command.extend(["-s", "format", "avif", "-s", "formatOptions", "95"])
    elif output_format == "jpeg":
        command.extend(["-s", "format", "jpeg", "-s", "formatOptions", "93"])
    else:
        command.extend(["-s", "format", "png"])
    command.extend([str(source), "--out", str(target)])
    subprocess.run(command, check=True, capture_output=True, text=True)
    return "generated"


def ensure_avif_support():
    result = subprocess.run(
        ["sips", "--formats"], check=True, capture_output=True, text=True
    )
    if not re.search(r"\bavif\s+Writable\b", result.stdout, re.IGNORECASE):
        raise RuntimeError(
            "This macOS sips installation cannot write AVIF. "
            "Use a macOS version with AVIF encoding support."
        )


def yaml_quote(value):
    return json.dumps(value, ensure_ascii=False)


def source_version(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_manifest_versions(paths):
    versions = {}
    for path in paths:
        if not path.is_file():
            continue
        current_reference = None
        for line in path.read_text(encoding="utf-8").splitlines():
            if line and not line.startswith(" ") and line.endswith(":"):
                try:
                    current_reference = json.loads(line[:-1])
                except json.JSONDecodeError:
                    current_reference = None
            elif current_reference and line.startswith("  version:"):
                versions[current_reference] = line.split(":", 1)[1].strip()
    return versions


def write_manifest(path, variants):
    lines = ["# Generated by python3 scripts/optimize_images.py; do not edit."]
    for reference in sorted(variants):
        metadata = variants[reference]
        lines.extend(
            [
                f"{yaml_quote(reference)}:",
                f"  width: {metadata['width']}",
                f"  height: {metadata['height']}",
                f"  version: {metadata['version']}",
            ]
        )
        if metadata.get("full_width"):
            lines.append(f"  full_width: {metadata['full_width']}")
        for output_format in ("avif", "jpeg", "png"):
            outputs = metadata[output_format]
            if not outputs:
                continue
            lines.append(f"  {output_format}:")
            for width, output_path in sorted(outputs.items(), key=lambda item: int(item[0])):
                lines.append(f"    {yaml_quote(width)}: {yaml_quote(output_path)}")

    temporary_path = path.with_suffix(".yml.tmp")
    temporary_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    temporary_path.replace(path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report the variants without creating images or the manifest.",
    )
    group = parser.add_mutually_exclusive_group()
    group.add_argument(
        "--photography-only",
        action="store_true",
        help="Generate the Photography gallery variants without updating the other image manifest.",
    )
    group.add_argument(
        "--footer-only",
        action="store_true",
        help="Generate the footer gallery variants without updating the other image manifests.",
    )
    args = parser.parse_args()

    assets = collect_assets(args.photography_only, args.footer_only)
    if any(asset["avif"] for asset in assets.values()):
        ensure_avif_support()

    variants = {}
    jobs = []
    original_bytes = 0
    previous_versions = read_manifest_versions(
        (MANIFEST_PATH, PHOTOGRAPHY_MANIFEST_PATH, FOOTER_MANIFEST_PATH)
    )
    for reference, asset in sorted(assets.items()):
        source = ROOT / reference.lstrip("/")
        width, height = image_dimensions(source)
        version = source_version(source)
        force = previous_versions.get(reference) != version
        original_bytes += source.stat().st_size
        metadata = {
            "width": width,
            "height": height,
            "version": version,
            "avif": {},
            "jpeg": {},
            "png": {},
        }
        if reference.startswith("/images/Photographs/"):
            full_width = min(width, max(1, round(width * GALLERY_LONG_EDGE / max(width, height))))
            metadata["full_width"] = full_width
            if width < 400:
                asset["avif"].add(width)
            asset["jpeg"].add(full_width)
        variants[reference] = metadata
        for output_format in ("avif", "jpeg", "png"):
            for target_width in sorted(asset[output_format]):
                if target_width > width or (target_width == width and not metadata.get("full_width")):
                    continue
                target_height = round(height * target_width / width)
                target = variant_path(reference, target_width, "jpg" if output_format == "jpeg" else output_format)
                metadata[output_format][str(target_width)] = (
                    "/" + target.relative_to(ROOT).as_posix()
                )
                jobs.append(
                    (
                        source,
                        target,
                        target_width,
                        target_height,
                        output_format,
                        force,
                    )
                )

    results = {"generated": 0, "skipped": 0, "planned": 0}
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        futures = [
            executor.submit(make_variant, *job, args.dry_run) for job in jobs
        ]
        for future in concurrent.futures.as_completed(futures):
            results[future.result()] += 1

    if not args.dry_run:
        if not args.footer_only:
            photography = {
                reference: metadata
                for reference, metadata in variants.items()
                if reference.startswith("/images/Photographs/")
            }
            write_manifest(PHOTOGRAPHY_MANIFEST_PATH, photography)
        if not args.photography_only:
            footer_images = footer_references()
            write_manifest(
                FOOTER_MANIFEST_PATH,
                {reference: variants[reference] for reference in footer_images},
            )
        if not args.photography_only and not args.footer_only:
            write_manifest(MANIFEST_PATH, variants)

    print(
        f"Sources: {len(assets)} ({original_bytes / 1024 / 1024:.1f} MB); "
        f"variants: {len(jobs)}; generated: {results['generated']}; "
        f"unchanged: {results['skipped']}"
        + (f"; planned: {results['planned']}" if args.dry_run else "")
    )


if __name__ == "__main__":
    try:
        main()
    except (OSError, re.error, RuntimeError, subprocess.CalledProcessError) as error:
        print(f"Image optimization failed: {error}", file=sys.stderr)
        sys.exit(1)

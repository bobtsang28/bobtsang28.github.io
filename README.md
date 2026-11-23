
## Responsive image delivery

Generate responsive image variants on macOS with AVIF-capable `sips`:

```sh
python3 scripts/optimize_images.py --photography-only
```

The command writes Photography AVIF and JPEG variants under `images/optimized/` and their dimensions and paths to `_data/photography_variants.yml`. Original images are never modified. Existing variants are reused when their source hash is unchanged; use `--dry-run` to inspect the plan.

### Photography originals

The original JPEGs live locally in `images/Photographs/`. That directory is ignored by Git and excluded from Jekyll output; it is not a backup and is not included when cloning this repository. Keep independent backups of the originals. A local copy of the current 33 originals is also stored at `~/bobtsang-photography-originals/`; this copy is on the same computer and is not a substitute for an independent backup.

To add or replace a photograph, place the original in `images/Photographs/`, update `_data/photography_gallery.yml`, and run the command above. Commit the updated Photography manifest and generated delivery variants, not the originals. On another computer, restore the original JPEGs into that directory from your backup before running the optimizer. Normal Jekyll builds use the committed manifest and variants and do not need the originals. Photography thumbnails use responsive 400/800-pixel AVIF or JPEG variants; the lightbox uses a JPEG with a longest edge up to 2560 pixels.

Without `--photography-only`, the script also scans project covers and stills, the About portrait, footer images, and festival laurels, writing their manifest to `_data/image_variants.yml`.

### Footer gallery images

The four shared footer images are listed in `_data/settings.yml`. After adding or replacing a source image, run `python3 scripts/optimize_images.py --footer-only` on macOS and commit the source, `_data/footer_gallery_variants.yml`, and the generated 400/800-pixel AVIF and JPEG variants. Source hashes invalidate stale variants and version their URLs. Normal builds use the committed delivery assets without running the optimizer.

### Project cover images

After adding or replacing a project cover, run `python3 scripts/optimize_images.py --projects-only` on macOS and commit `_data/project_variants.yml` and the generated JPEG variants for that cover. The Projects overview uses JPEG variants because some larger AVIFs produced by `sips` decode as blank in browsers. Source hashes version the URLs, and normal builds use the committed variants without running the optimizer.

### Publishing

GitHub Pages must use the GitHub Actions source. The Pages workflow builds with Ruby 3.2.9 and the locked Bundler dependencies, then resizes legacy JPEGs **in the generated site only** to a maximum 2560-pixel long edge at JPEG quality 93. This keeps their URLs and source originals intact, but the published versions no longer provide their original full resolution. ExifTool removes image metadata from the generated site without recompressing pixels, retaining color profiles, orientation and copyright/credit fields. The workflow verifies Photography delivery assets and fails if the site exceeds 800 MiB. Metadata and full-resolution images already committed to the public repository or its history remain accessible there; the publishing step cannot remove them from Git.

To reproduce the published build on macOS, install ExifTool 13.64, build into a disposable directory and run:

```sh
bundle exec jekyll build --destination /tmp/portfolio-site
python3 scripts/optimize_published_images.py /tmp/portfolio-site
bundle exec ruby scripts/verify_photography.rb /tmp/portfolio-site
```

The workflow pins Actions and ExifTool to upstream commit SHAs. When updating them, verify the release or maintained tag against the official repository, update the corresponding SHA and version comment in the workflow, and test the build and deployment before relying on the new version.

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from optimize_published_images import strip_metadata


class StripMetadataTests(unittest.TestCase):
    def test_mislabeled_png_is_processed_without_changing_its_url(self):
        with tempfile.TemporaryDirectory() as directory:
            images = Path(directory) / "images"
            images.mkdir()
            image = images / "photo.jpg"
            image.write_bytes(b"\x89PNG\r\n\x1a\noriginal")

            def clean(arguments, **kwargs):
                temporary = Path(arguments[-1])
                self.assertEqual(temporary.suffix, ".png")
                self.assertEqual(image.read_bytes(), b"\x89PNG\r\n\x1a\noriginal")
                if "-json" in arguments:
                    return subprocess.CompletedProcess(arguments, 0,
                                                       stdout=f'[{{"SourceFile": "{temporary}"}}]')
                temporary.write_bytes(b"cleaned")

            with patch("optimize_published_images.subprocess.run", side_effect=clean):
                self.assertEqual(strip_metadata(images, "exiftool"), 1)
            self.assertEqual(image.read_bytes(), b"cleaned")

    def test_failure_does_not_replace_mislabeled_original(self):
        with tempfile.TemporaryDirectory() as directory:
            images = Path(directory) / "images"
            images.mkdir()
            image = images / "photo.jpg"
            original = b"\x89PNG\r\n\x1a\noriginal"
            image.write_bytes(original)

            with patch("optimize_published_images.subprocess.run",
                       side_effect=subprocess.CalledProcessError(1, "exiftool")):
                with self.assertRaises(subprocess.CalledProcessError):
                    strip_metadata(images, "exiftool")
            self.assertEqual(image.read_bytes(), original)

    def test_remaining_private_metadata_fails_verification(self):
        with tempfile.TemporaryDirectory() as directory:
            images = Path(directory) / "images"
            images.mkdir()
            image = images / "photo.jpg"
            original = b"\x89PNG\r\n\x1a\noriginal"
            image.write_bytes(original)

            def clean(arguments, **kwargs):
                if "-json" in arguments:
                    return subprocess.CompletedProcess(
                        arguments, 0,
                        stdout=f'[{{"SourceFile": "{arguments[-1]}", "GPSLatitude": "redacted"}}]',
                    )

            with patch("optimize_published_images.subprocess.run", side_effect=clean):
                with self.assertRaisesRegex(RuntimeError, "Private metadata remains"):
                    strip_metadata(images, "exiftool")
            self.assertEqual(image.read_bytes(), original)


if __name__ == "__main__":
    unittest.main()

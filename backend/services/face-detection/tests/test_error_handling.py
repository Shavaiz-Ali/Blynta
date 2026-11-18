"""Integration-style error handling tests."""
import sys
import json
import subprocess
import unittest
from pathlib import Path

SERVICE_ROOT = Path(__file__).parent.parent
PYTHON = sys.executable


class TestCLIMissingFile(unittest.TestCase):
    """CLI should return JSON with success:false and exit non-zero for missing files."""

    def _run_cli(self, *args):
        result = subprocess.run(
            [PYTHON, "-m", "src.main"] + list(args),
            capture_output=True, text=True, cwd=str(SERVICE_ROOT),
        )
        return result

    def test_image_missing_input(self):
        r = self._run_cli("image", "--input", "/nonexistent/image.jpg")
        self.assertNotEqual(r.returncode, 0)
        data = json.loads(r.stdout)
        self.assertFalse(data["success"])
        self.assertIn("error", data)

    def test_video_missing_input(self):
        r = self._run_cli("video", "--input", "/nonexistent/video.mp4")
        self.assertNotEqual(r.returncode, 0)
        data = json.loads(r.stdout)
        self.assertFalse(data["success"])

    def test_image_missing_model(self):
        import tempfile
        import cv2
        import numpy as np

        # Create a small valid test image so the CLI gets past input-file validation
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
            tmp_img = Path(f.name)
        img = np.zeros((100, 100, 3), dtype=np.uint8)
        cv2.imwrite(str(tmp_img), img)

        try:
            r = self._run_cli(
                "image",
                "--input", str(tmp_img),
                "--model", "/nonexistent/model.tflite"
            )
            self.assertEqual(r.returncode, 2)
            data = json.loads(r.stdout)
            self.assertFalse(data["success"])
            self.assertIn("not found", data.get("error", "").lower())
        finally:
            if tmp_img.exists():
                tmp_img.unlink()


if __name__ == "__main__":
    unittest.main()

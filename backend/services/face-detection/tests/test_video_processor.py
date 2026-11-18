"""Tests for VideoProcessor."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock

sys.path.insert(0, str(Path(__file__).parent.parent))


class TestVideoProcessorMissingFile(unittest.TestCase):
    def test_missing_file_returns_error_result(self):
        from src.config import Config
        from src.detector import FaceDetector
        from src.video_processor import VideoProcessor

        with patch.object(FaceDetector, "_initialize", return_value=None):
            config = Config()
            det = FaceDetector.__new__(FaceDetector)
            det._config = config
            det._detector = MagicMock()
            processor = VideoProcessor(det, config)
            result = processor.process(Path("/nonexistent/video.mp4"))
            self.assertFalse(result.success)
            self.assertIn("not found", result.error.lower())


class TestVideoProcessorInvalidVideo(unittest.TestCase):
    def test_cannot_open_video_returns_error(self):
        import tempfile
        import os
        from src.config import Config
        from src.detector import FaceDetector
        from src.video_processor import VideoProcessor

        with patch.object(FaceDetector, "_initialize", return_value=None):
            config = Config()
            det = FaceDetector.__new__(FaceDetector)
            det._config = config
            det._detector = MagicMock()
            processor = VideoProcessor(det, config)

            # Create a corrupt "video" file
            with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
                f.write(b"THIS IS NOT A VALID VIDEO")
                tmp_path = Path(f.name)

            try:
                result = processor.process(tmp_path)
                self.assertFalse(result.success)
            finally:
                os.unlink(tmp_path)


if __name__ == "__main__":
    unittest.main()

"""Tests for the FaceDetector class."""
import sys
import os
import unittest
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock

# Allow running from the service root: python -m pytest tests/
sys.path.insert(0, str(Path(__file__).parent.parent))


class TestFaceDetectorInit(unittest.TestCase):
    """Tests detector initialization and error handling."""

    def test_missing_model_raises_file_not_found(self):
        from src.config import Config
        from src.detector import FaceDetector
        config = Config(model_path=Path("/nonexistent/model.tflite"))
        with self.assertRaises(FileNotFoundError) as ctx:
            FaceDetector(config)
        self.assertIn("not found", str(ctx.exception).lower())

    def test_invalid_config_confidence_boundary(self):
        """Config stores whatever float is passed — clamping is MediaPipe's job."""
        from src.config import Config
        c = Config(min_detection_confidence=0.0)
        self.assertEqual(c.min_detection_confidence, 0.0)
        c2 = Config(min_detection_confidence=1.0)
        self.assertEqual(c2.min_detection_confidence, 1.0)


class TestFaceDetectorInputValidation(unittest.TestCase):
    """Tests detect() input validation without loading a real model."""

    def _make_detector_with_mock(self):
        """Return a FaceDetector with _detector replaced by a mock."""
        from src.config import Config
        from src.detector import FaceDetector
        import numpy as np

        # Patch the _initialize so we don't need a real model file
        with patch.object(FaceDetector, "_initialize", return_value=None):
            config = Config(model_path=Path("/fake/model.tflite"))
            det = FaceDetector.__new__(FaceDetector)
            det._config = config
            mock_inner = MagicMock()
            mock_result = MagicMock()
            mock_result.detections = []
            mock_inner.detect.return_value = mock_result
            det._detector = mock_inner
            return det

    def test_none_frame_raises_value_error(self):
        det = self._make_detector_with_mock()
        with self.assertRaises(ValueError):
            det.detect(None)

    def test_zero_dimension_frame_raises_value_error(self):
        import numpy as np
        det = self._make_detector_with_mock()
        with self.assertRaises(ValueError):
            det.detect(np.zeros((0, 640, 3), dtype=np.uint8))

    def test_valid_frame_returns_list(self):
        import numpy as np
        det = self._make_detector_with_mock()
        result = det.detect(np.zeros((480, 640, 3), dtype=np.uint8))
        self.assertIsInstance(result, list)
        self.assertEqual(len(result), 0)  # mock returns no detections


class TestBoundingBoxNormalization(unittest.TestCase):
    """Unit tests for normalization math in models."""

    def test_bounding_box_values_in_range(self):
        from src.models import BoundingBox
        bb = BoundingBox(x=0.1, y=0.2, width=0.3, height=0.4)
        self.assertGreaterEqual(bb.x, 0.0)
        self.assertLessEqual(bb.x + bb.width, 1.0)

    def test_face_detection_to_dict_structure(self):
        from src.models import FaceDetection, BoundingBox, Keypoint
        fd = FaceDetection(
            confidence=0.95,
            bounding_box=BoundingBox(x=0.1, y=0.2, width=0.3, height=0.4),
            keypoints=[Keypoint(x=0.25, y=0.3, label="right_eye")],
        )
        d = fd.to_dict()
        self.assertIn("confidence", d)
        self.assertIn("boundingBox", d)
        self.assertIn("keypoints", d)
        self.assertIn("right_eye", d["keypoints"])


if __name__ == "__main__":
    unittest.main()

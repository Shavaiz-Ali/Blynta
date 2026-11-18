"""MediaPipe Face Detector wrapper."""
from __future__ import annotations
import logging
from pathlib import Path
from typing import List, Optional

import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision
import numpy as np

from .config import Config
from .models import FaceDetection, BoundingBox, Keypoint

logger = logging.getLogger(__name__)

# MediaPipe keypoint labels (BlazeFace order)
_KP_LABELS = [
    "right_eye", "left_eye", "nose_tip",
    "mouth_center", "right_ear_tragion", "left_ear_tragion",
]


class FaceDetector:
    """Wraps MediaPipe FaceDetector; initializes once per process."""

    def __init__(self, config: Config) -> None:
        self._config = config
        self._detector: Optional[mp_vision.FaceDetector] = None
        self._initialize()

    def _initialize(self) -> None:
        model_path = self._config.model_path
        if not model_path.exists():
            raise FileNotFoundError(
                f"Model file not found: {model_path}\n"
                "Run scripts/download_model.sh (Linux) or "
                "scripts/download_model.ps1 (Windows) to download it."
            )
        base_options = mp_python.BaseOptions(
            model_asset_path=str(model_path)
        )
        options = mp_vision.FaceDetectorOptions(
            base_options=base_options,
            min_detection_confidence=self._config.min_detection_confidence,
        )
        self._detector = mp_vision.FaceDetector.create_from_options(options)
        logger.info(
            "FaceDetector initialized | model=%s | confidence=%.2f",
            model_path.name,
            self._config.min_detection_confidence,
        )

    def detect(self, bgr_frame: np.ndarray) -> List[FaceDetection]:
        """
        Run face detection on a BGR numpy array (as returned by OpenCV).

        Returns a list of FaceDetection objects with NORMALIZED coordinates.
        Coordinates are normalized to [0, 1] relative to the original frame size.
        """
        if bgr_frame is None or bgr_frame.size == 0:
            raise ValueError("Invalid frame: empty or None")

        h, w = bgr_frame.shape[:2]
        if h == 0 or w == 0:
            raise ValueError(f"Invalid frame dimensions: {w}x{h}")

        # Downscale for inference if needed (preserves coordinate mapping)
        inference_frame, _, _ = self._maybe_downscale(bgr_frame)

        # MediaPipe expects RGB
        rgb_frame = inference_frame[:, :, ::-1].copy()
        mp_image = mp.Image(
            image_format=mp.ImageFormat.SRGB, data=rgb_frame
        )

        result = self._detector.detect(mp_image)
        detections = []

        if not result.detections:
            return detections

        inf_h, inf_w = inference_frame.shape[:2]

        for det in result.detections:
            bbox = det.bounding_box

            # MediaPipe returns pixel coordinates on the inference frame.
            # Normalizing by inference frame dimensions yields correct [0, 1]
            # coordinates relative to the original frame because aspect ratio is preserved.
            norm_x = bbox.origin_x / inf_w
            norm_y = bbox.origin_y / inf_h
            norm_w = bbox.width / inf_w
            norm_h = bbox.height / inf_h

            # Clamp to [0, 1]
            norm_x = max(0.0, min(1.0, norm_x))
            norm_y = max(0.0, min(1.0, norm_y))
            norm_w = max(0.0, min(1.0 - norm_x, norm_w))
            norm_h = max(0.0, min(1.0 - norm_y, norm_h))

            keypoints = []
            if det.keypoints:
                for i, kp in enumerate(det.keypoints):
                    label = _KP_LABELS[i] if i < len(_KP_LABELS) else f"kp_{i}"
                    keypoints.append(
                        Keypoint(x=round(kp.x, 6), y=round(kp.y, 6), label=label)
                    )

            confidence = det.categories[0].score if det.categories else 0.0

            detections.append(
                FaceDetection(
                    confidence=confidence,
                    bounding_box=BoundingBox(
                        x=norm_x, y=norm_y, width=norm_w, height=norm_h
                    ),
                    keypoints=keypoints,
                )
            )

        logger.debug("Detected %d face(s)", len(detections))
        return detections

    def _maybe_downscale(
        self, frame: np.ndarray
    ) -> tuple[np.ndarray, float, float]:
        """
        Downscale frame if either dimension exceeds max_inference_dim.
        Returns (possibly_downscaled_frame, scale_x, scale_y).
        scale values < 1 mean the frame was shrunk.
        """
        import cv2  # noqa: PLC0415
        h, w = frame.shape[:2]
        max_dim = self._config.max_inference_dim
        if w <= max_dim and h <= max_dim:
            return frame, 1.0, 1.0
        scale = min(max_dim / w, max_dim / h)
        new_w, new_h = int(w * scale), int(h * scale)
        downscaled = cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_AREA)
        return downscaled, scale, scale

    def close(self) -> None:
        if self._detector:
            self._detector.close()
            self._detector = None

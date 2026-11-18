"""Configuration for the face-detection service."""
from __future__ import annotations
import os
from dataclasses import dataclass, field
from pathlib import Path

# Root of this service
SERVICE_ROOT = Path(__file__).parent.parent.resolve()
MODELS_DIR = SERVICE_ROOT / "models"

@dataclass
class Config:
    model_path: Path = field(
        default_factory=lambda: MODELS_DIR / "blaze_face_short_range.tflite"
    )
    min_detection_confidence: float = 0.5
    # Frame sampling interval in seconds (video processing)
    frame_interval: float = 1.0
    # Maximum image dimension before downscaling for inference
    max_inference_dim: int = 1280

    @classmethod
    def from_env(cls) -> "Config":
        return cls(
            model_path=Path(
                os.environ.get("FACE_DETECTOR_MODEL_PATH",
                               str(MODELS_DIR / "blaze_face_short_range.tflite"))
            ),
            min_detection_confidence=float(
                os.environ.get("FACE_DETECTOR_CONFIDENCE", "0.5")
            ),
            frame_interval=float(
                os.environ.get("FACE_DETECTOR_INTERVAL", "1.0")
            ),
            max_inference_dim=int(
                os.environ.get("FACE_DETECTOR_MAX_DIM", "1280")),
        )

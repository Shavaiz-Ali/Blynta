"""Pure-data models (output contract)."""
from __future__ import annotations
from dataclasses import dataclass, asdict, field
from typing import List, Optional

@dataclass
class BoundingBox:
    x: float      # normalized [0, 1] — left edge
    y: float      # normalized [0, 1] — top edge
    width: float  # normalized [0, 1]
    height: float # normalized [0, 1]

@dataclass
class Keypoint:
    x: float  # normalized
    y: float  # normalized
    label: Optional[str] = None

@dataclass
class FaceDetection:
    confidence: float
    bounding_box: BoundingBox
    keypoints: List[Keypoint] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "confidence": round(self.confidence, 4),
            "boundingBox": {
                "x": round(self.bounding_box.x, 6),
                "y": round(self.bounding_box.y, 6),
                "width": round(self.bounding_box.width, 6),
                "height": round(self.bounding_box.height, 6),
            },
            "keypoints": {
                kp.label or f"kp_{i}": {"x": round(kp.x, 6), "y": round(kp.y, 6)}
                for i, kp in enumerate(self.keypoints)
            },
        }

@dataclass
class FrameResult:
    timestamp: float
    faces: List[FaceDetection]

    def to_dict(self) -> dict:
        return {
            "timestamp": round(self.timestamp, 4),
            "faces": [f.to_dict() for f in self.faces],
        }

@dataclass
class VideoMetadata:
    width: int
    height: int
    fps: float
    duration: float

@dataclass
class DetectionResult:
    success: bool
    metadata: Optional[VideoMetadata]
    frames: List[FrameResult]
    error: Optional[str] = None

    def to_dict(self) -> dict:
        result: dict = {"success": self.success}
        if self.metadata:
            result["metadata"] = {
                "width": self.metadata.width,
                "height": self.metadata.height,
                "fps": self.metadata.fps,
                "duration": self.metadata.duration,
            }
        result["frames"] = [f.to_dict() for f in self.frames]
        if self.error:
            result["error"] = self.error
        return result

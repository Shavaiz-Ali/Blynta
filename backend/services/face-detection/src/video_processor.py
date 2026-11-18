"""Video frame extraction and face detection orchestration."""
from __future__ import annotations
import logging
import subprocess
import json
from pathlib import Path
from typing import List, Optional

import cv2

from .config import Config
from .detector import FaceDetector
from .models import DetectionResult, FrameResult, VideoMetadata

logger = logging.getLogger(__name__)


def _get_video_metadata_ffprobe(video_path: Path) -> Optional[VideoMetadata]:
    """Use ffprobe to read video metadata reliably."""
    try:
        cmd = [
            "ffprobe", "-v", "quiet",
            "-print_format", "json",
            "-show_streams",
            "-show_format",
            str(video_path),
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode != 0:
            return None
        data = json.loads(result.stdout)
        format_duration = float(data.get("format", {}).get("duration", 0) or 0)
        for stream in data.get("streams", []):
            if stream.get("codec_type") == "video":
                w = int(stream.get("width", 0))
                h = int(stream.get("height", 0))
                # Parse fps fraction e.g. "30000/1001"
                fps_str = stream.get("avg_frame_rate", "0/1")
                try:
                    num, den = fps_str.split("/")
                    fps = float(num) / float(den) if float(den) else 0.0
                except (ValueError, ZeroDivisionError):
                    fps = 0.0
                stream_duration = float(stream.get("duration", 0) or 0)
                duration = stream_duration if stream_duration > 0 else format_duration
                if w > 0 and h > 0:
                    return VideoMetadata(width=w, height=h, fps=fps, duration=duration)
    except Exception as exc:  # noqa: BLE001
        logger.warning("ffprobe failed: %s", exc)
    return None


def _get_video_metadata_cv2(video_path: Path, cap: cv2.VideoCapture) -> VideoMetadata:
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = cap.get(cv2.CAP_PROP_FRAME_COUNT)
    duration = total_frames / fps if fps > 0 else 0.0
    return VideoMetadata(width=w, height=h, fps=fps, duration=duration)


class VideoProcessor:
    """Extracts frames at a configurable interval and runs face detection."""

    def __init__(self, detector: FaceDetector, config: Config) -> None:
        self._detector = detector
        self._config = config

    def process(self, video_path: Path) -> DetectionResult:
        if not video_path.exists():
            return DetectionResult(
                success=False,
                metadata=None,
                frames=[],
                error=f"Video file not found: {video_path}",
            )

        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            return DetectionResult(
                success=False,
                metadata=None,
                frames=[],
                error=f"Cannot open video: {video_path}",
            )

        # Prefer ffprobe metadata; fall back to cv2
        meta = _get_video_metadata_ffprobe(video_path)
        if meta is None:
            meta = _get_video_metadata_cv2(video_path, cap)
        elif meta.duration <= 0.0:
            cv2_meta = _get_video_metadata_cv2(video_path, cap)
            meta.duration = cv2_meta.duration

        fps = meta.fps if meta.fps > 0 else 30.0
        interval = max(self._config.frame_interval, 1.0 / fps)
        interval_frames = max(1, int(fps * interval))

        logger.info(
            "Processing video | %s | %dx%d | %.2f fps | interval=%.2fs (%d frames)",
            video_path.name, meta.width, meta.height, fps,
            interval, interval_frames,
        )

        frame_results: List[FrameResult] = []
        frame_index = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_index % interval_frames == 0:
                timestamp = frame_index / fps
                try:
                    faces = self._detector.detect(frame)
                    frame_results.append(
                        FrameResult(timestamp=timestamp, faces=faces)
                    )
                    if faces:
                        logger.debug(
                            "t=%.2fs: %d face(s)", timestamp, len(faces)
                        )
                except Exception as exc:  # noqa: BLE001
                    logger.warning("Frame %d detection error: %s", frame_index, exc)
                    # Include empty result rather than stopping
                    frame_results.append(
                        FrameResult(timestamp=timestamp, faces=[])
                    )

            frame_index += 1

        cap.release()
        logger.info(
            "Done | %d frames sampled | %d frames with faces",
            len(frame_results),
            sum(1 for fr in frame_results if fr.faces),
        )

        return DetectionResult(
            success=True,
            metadata=meta,
            frames=frame_results,
        )

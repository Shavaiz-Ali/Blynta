"""CLI entry point for the face-detection service.

Usage:
  python -m src.main image --input path/to/image.jpg
  python -m src.main video --input path/to/video.mp4 --interval 0.5
  python -m src.main image --input img.jpg --confidence 0.6 --model /path/to/model.tflite
"""
from __future__ import annotations
import argparse
import json
import logging
import sys
import time
from pathlib import Path

import cv2

from .config import Config
from .detector import FaceDetector
from .models import DetectionResult, FrameResult, VideoMetadata
from .video_processor import VideoProcessor


def _setup_logging(verbose: bool = False) -> None:
    level = logging.DEBUG if verbose else logging.WARNING
    logging.basicConfig(
        stream=sys.stderr,
        level=level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )


def _build_config(args: argparse.Namespace) -> Config:
    config = Config.from_env()
    if hasattr(args, "confidence") and args.confidence is not None:
        config.min_detection_confidence = args.confidence
    if hasattr(args, "model") and args.model is not None:
        config.model_path = Path(args.model)
    if hasattr(args, "interval") and args.interval is not None:
        config.frame_interval = args.interval
    return config


def _dump_json(obj: dict, verbose: bool = False) -> str:
    """Serialize JSON compactly in production, or indented if verbose."""
    indent = 2 if verbose else None
    return json.dumps(obj, indent=indent)


def cmd_image(args: argparse.Namespace) -> int:
    config = _build_config(args)
    input_path = Path(args.input)
    verbose = getattr(args, "verbose", False)

    if not input_path.exists():
        result = DetectionResult(
            success=False, metadata=None, frames=[],
            error=f"Input file not found: {input_path}"
        )
        print(_dump_json(result.to_dict(), verbose))
        return 1

    frame = cv2.imread(str(input_path))
    if frame is None:
        result = DetectionResult(
            success=False, metadata=None, frames=[],
            error=f"Cannot read image: {input_path}"
        )
        print(_dump_json(result.to_dict(), verbose))
        return 1

    h, w = frame.shape[:2]
    meta = VideoMetadata(width=w, height=h, fps=0.0, duration=0.0)

    t0 = time.perf_counter()
    try:
        detector = FaceDetector(config)
        faces = detector.detect(frame)
        elapsed = time.perf_counter() - t0
        logging.getLogger(__name__).info("Detection took %.3fs", elapsed)
        result = DetectionResult(
            success=True,
            metadata=meta,
            frames=[FrameResult(timestamp=0.0, faces=faces)],
        )
        output = result.to_dict()
        output["_timing"] = {"detection_ms": round(elapsed * 1000, 2)}
        print(_dump_json(output, verbose))
        return 0
    except FileNotFoundError as exc:
        result = DetectionResult(
            success=False, metadata=None, frames=[], error=str(exc)
        )
        print(_dump_json(result.to_dict(), verbose))
        return 2
    except Exception as exc:  # noqa: BLE001
        result = DetectionResult(
            success=False, metadata=None, frames=[], error=str(exc)
        )
        print(_dump_json(result.to_dict(), verbose))
        return 1


def cmd_video(args: argparse.Namespace) -> int:
    config = _build_config(args)
    input_path = Path(args.input)
    verbose = getattr(args, "verbose", False)

    t0 = time.perf_counter()
    try:
        detector = FaceDetector(config)
        processor = VideoProcessor(detector, config)
        result = processor.process(input_path)
        elapsed = time.perf_counter() - t0
        output = result.to_dict()
        output["_timing"] = {
            "total_ms": round(elapsed * 1000, 2),
            "frames_sampled": len(result.frames),
        }
        print(_dump_json(output, verbose))
        return 0 if result.success else 1
    except FileNotFoundError as exc:
        result_err = DetectionResult(
            success=False, metadata=None, frames=[], error=str(exc)
        )
        print(_dump_json(result_err.to_dict(), verbose))
        return 2
    except Exception as exc:  # noqa: BLE001
        result_err = DetectionResult(
            success=False, metadata=None, frames=[], error=str(exc)
        )
        print(_dump_json(result_err.to_dict(), verbose))
        return 1


def main() -> int:
    parser = argparse.ArgumentParser(
        prog="face-detector",
        description="Blynta MediaPipe face-detection service (standalone CLI)",
    )
    parser.add_argument("--verbose", "-v", action="store_true",
                        help="Enable debug logging to stderr")
    sub = parser.add_subparsers(dest="command", required=True)

    # image subcommand
    img_parser = sub.add_parser("image", help="Detect faces in an image")
    img_parser.add_argument("--input", "-i", required=True, help="Path to image file")
    img_parser.add_argument("--confidence", "-c", type=float, default=None,
                            help="Minimum detection confidence (0–1)")
    img_parser.add_argument("--model", "-m", default=None,
                            help="Path to .tflite model file")

    # video subcommand
    vid_parser = sub.add_parser("video", help="Detect faces in a video")
    vid_parser.add_argument("--input", "-i", required=True, help="Path to video file")
    vid_parser.add_argument("--interval", type=float, default=None,
                            help="Frame sampling interval in seconds (default: 1.0)")
    vid_parser.add_argument("--confidence", "-c", type=float, default=None,
                            help="Minimum detection confidence (0–1)")
    vid_parser.add_argument("--model", "-m", default=None,
                            help="Path to .tflite model file")

    args = parser.parse_args()
    _setup_logging(args.verbose)

    if args.command == "image":
        return cmd_image(args)
    elif args.command == "video":
        return cmd_video(args)
    return 1


if __name__ == "__main__":
    sys.exit(main())

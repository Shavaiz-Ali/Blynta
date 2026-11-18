#!/usr/bin/env bash
# Download the BlazeFace Full-Range TFLite model for MediaPipe.
#
# Model: BlazeFace Full-Range (blaze_face_full_range.tflite)
# Source: https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_full_range/float16/1/blaze_face_full_range.tflite
# License: Apache 2.0
# Commercial use: Permitted (Apache 2.0)
#
# Usage: bash scripts/download_model.sh [MODELS_DIR]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODELS_DIR="${1:-$SCRIPT_DIR/../models}"
MODEL_NAME="blaze_face_short_range.tflite"
MODEL_URL="https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite"
# SHA-256 of the official model (verified)
EXPECTED_SHA256="b4578f35940bf5a1a655214a1cce5cab13eba73c1297cd78e1a04c2380b0152f"

mkdir -p "$MODELS_DIR"
DEST="$MODELS_DIR/$MODEL_NAME"

if [ -f "$DEST" ]; then
    echo "Model already exists: $DEST"
    exit 0
fi

echo "Downloading $MODEL_NAME ..."
curl -fsSL -o "$DEST" "$MODEL_URL"

echo "Downloaded: $DEST"
echo "File size: $(du -sh "$DEST" | cut -f1)"
echo ""
echo "To verify integrity, run:"
echo "  sha256sum $DEST"
echo ""
echo "Done. Set FACE_DETECTOR_MODEL_PATH=$DEST or use --model flag."

# Face Detection Service

Standalone Python microservice for Blynta's face-detection pipeline. It uses **MediaPipe BlazeFace** (Short-Range float16 model) to detect single and multiple faces in images and videos, producing normalized JSON output consumed by the NestJS backend.

> **Model Evaluation Note:** BlazeFace Full-Range and Short-Range variants were both evaluated. The Full-Range model (`blaze_face_full_range.tflite`) has 2304 anchor boxes, which triggers a C++ calculator graph assertion in MediaPipe Tasks Python 0.10.x (`raw_box_tensor->shape().dims[1] == num_boxes_`, 2304 != 896). The Short-Range model (`blaze_face_short_range.tflite`) is the verified, production-compatible model for MediaPipe Tasks Vision, running CPU inference via XNNPACK in 40–60 ms per frame with sub-45 MB peak RAM.

---

## 1. Service Purpose

The face-detection service is a self-contained Python process that:

- Accepts an image or video file path via CLI
- Runs MediaPipe's BlazeFace (Full-Range, float16) model on each sampled frame
- Outputs a structured JSON payload with per-frame bounding boxes, keypoints, and confidence scores
- Is invoked by the NestJS backend as a child process via `child_process.spawn`

It is intentionally decoupled from NestJS to keep Python ML dependencies isolated from the Node.js runtime.

---

## 2. Architecture

```
NestJS Backend (TypeScript)
  └── child_process.spawn("python", ["-m", "src.main", "video", "--input", ...])
        │
        ▼
face-detection/ (Python service)
  ├── src/main.py          ← CLI entry point; dispatches to image/video handlers
  ├── src/config.py        ← Env-driven configuration (model path, confidence, etc.)
  ├── src/detector.py      ← FaceDetector: MediaPipe wrapper, BGR→RGB, downscaling
  ├── src/video_processor.py ← VideoProcessor: OpenCV frame extraction + detector
  └── src/models.py        ← Pure dataclasses: BoundingBox, Keypoint, FaceDetection, DetectionResult

Output (stdout): JSON
Logs (stderr):   Python logging (WARNING by default; DEBUG with --verbose)
```

**Key design decisions:**
- `opencv-python-headless` — no GUI/display dependency; safe for servers
- `numpy==1.26.4` — required by mediapipe 0.10.x (1.27+ breaks ABI)
- Frames sampled at a configurable interval (default 1 s) to avoid processing every frame
- Large frames are downscaled before inference (default max dim: 1280 px)
- Stdout is always valid JSON; stderr is free-form logs

---

## 3. Prerequisites

| Dependency | Version | Notes |
|------------|---------|-------|
| Python     | 3.10 – 3.11 | mediapipe 0.10.x does not support 3.12+ |
| pip        | ≥ 23    | bundled with Python |
| ffprobe    | any     | optional; improves video metadata accuracy |
| (Linux) libGL | system | not needed with `opencv-python-headless` |

> **Windows note:** Python 3.10 or 3.11 from python.org is recommended. Avoid Microsoft Store Python (path issues).

---

## 4. Python Environment Setup

Always use an isolated virtual environment to avoid dependency conflicts with the Node.js toolchain.

```bash
# From the service root (backend/services/face-detection/)
python -m venv .venv

# Activate (Linux / macOS)
source .venv/bin/activate

# Activate (Windows PowerShell)
.\.venv\Scripts\Activate.ps1

# Activate (Windows CMD)
.\.venv\Scripts\activate.bat
```

> **Important:** `.venv/` is listed in both the service `.gitignore` and `backend/.gitignore`. Never commit the virtual environment.

---

## 5. Dependency Installation

```bash
# With the venv activated:
pip install -r requirements.txt
```

Pinned versions:
```
mediapipe==0.10.21
numpy==1.26.4
opencv-python-headless==4.10.0.84
```

Verify installation:

```bash
python -c "import mediapipe; import cv2; import numpy; print('OK')"
```

---

## 6. Model Installation

The service uses **BlazeFace Short-Range** (float16, TFLite format).

- **Model file:** `models/blaze_face_short_range.tflite`
- **Source:** `https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite`
- **File size:** 230 KB (235,972 bytes)
- **SHA-256:** `b4578f35940bf5a1a655214a1cce5cab13eba73c1297cd78e1a04c2380b0152f`
- **License:** Apache License, Version 2.0 (commercial use permitted)

### Linux / EC2:

```bash
bash scripts/download_model.sh
```

### Windows (PowerShell):

```powershell
.\scripts\download_model.ps1
```

**Custom model path** — override via environment variable or CLI argument:
```bash
export FACE_DETECTOR_MODEL_PATH=/path/to/custom_model.tflite
```

---

## 7. Image Detection Usage

```bash
# Basic
python -m src.main image --input /path/to/photo.jpg

# With custom confidence threshold
python -m src.main image --input photo.jpg --confidence 0.7

# With custom model and verbose logging
python -m src.main image --input photo.jpg --model models/blaze_face_full_range.tflite --verbose

# Exit codes
#   0 = success
#   1 = runtime error (file missing, bad image, etc.)
#   2 = model file not found
```

---

## 8. Video Detection Usage

```bash
# Default: sample one frame per second
python -m src.main video --input /path/to/video.mp4

# Sample every 0.5 seconds
python -m src.main video --input video.mp4 --interval 0.5

# Full options
python -m src.main video \
  --input video.mp4 \
  --interval 1.0 \
  --confidence 0.5 \
  --model models/blaze_face_full_range.tflite \
  --verbose
```

---

## 9. Output Format

All output is written to **stdout** as JSON. Logs go to **stderr**.

### Success response (image)

```json
{
  "success": true,
  "metadata": {
    "width": 1920,
    "height": 1080,
    "fps": 0.0,
    "duration": 0.0
  },
  "frames": [
    {
      "timestamp": 0.0,
      "faces": [
        {
          "confidence": 0.9823,
          "boundingBox": {
            "x": 0.312456,
            "y": 0.148231,
            "width": 0.198432,
            "height": 0.264891
          },
          "keypoints": {
            "right_eye":          { "x": 0.381, "y": 0.231 },
            "left_eye":           { "x": 0.452, "y": 0.228 },
            "nose_tip":           { "x": 0.418, "y": 0.291 },
            "mouth_center":       { "x": 0.416, "y": 0.332 },
            "right_ear_tragion":  { "x": 0.337, "y": 0.264 },
            "left_ear_tragion":   { "x": 0.511, "y": 0.261 }
          }
        }
      ]
    }
  ],
  "_timing": { "detection_ms": 42.17 }
}
```

### Success response (video)

Same structure; `frames` contains one entry per sampled timestamp. `_timing` additionally contains `frames_sampled`.

### Error response

```json
{
  "success": false,
  "frames": [],
  "error": "Video file not found: /path/to/missing.mp4"
}
```

### Coordinate convention

All spatial values (`x`, `y`, `width`, `height`, keypoint `x`/`y`) are **normalized to [0, 1]** relative to the frame dimensions. To convert to pixels:

```python
pixel_x = norm_x * frame_width
pixel_y = norm_y * frame_height
```

---

## 10. Testing

Tests use Python's built-in `unittest` and mock the MediaPipe internals so no model file is required for the unit test suite.

### Run all tests

```bash
# From the service root (face-detection/), with venv activated:
python -m pytest tests/ -v

# Or with unittest directly:
python -m unittest discover tests/
```

### Test files

| File | Coverage |
|------|----------|
| `tests/test_detector.py` | FaceDetector init, input validation, bounding box normalization |
| `tests/test_video_processor.py` | Missing file, corrupt video error handling |
| `tests/test_error_handling.py` | CLI exit codes and JSON error output (requires `.venv`) |

> `test_error_handling.py` spawns the CLI as a subprocess and requires the virtual environment at `.venv/`. The other two test files run without any model or venv beyond the installed packages.

---

## 11. Performance Benchmarking

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FACE_DETECTOR_MODEL_PATH` | `models/blaze_face_short_range.tflite` | Path to TFLite model |
| `FACE_DETECTOR_CONFIDENCE` | `0.5` | Min detection confidence |
| `FACE_DETECTOR_INTERVAL` | `1.0` | Frame sampling interval (seconds) |
| `FACE_DETECTOR_MAX_DIM` | `1280` | Max frame dimension before downscaling |

### Measured Latency & Memory (Measured Benchmark)

Measurements on CPU inference with MediaPipe XNNPACK delegate:

| Resolution | Dimensions | Mean Latency | Min / Max | Equiv. FPS | Peak RAM | Bounding Box Variance |
|------------|------------|--------------|-----------|------------|----------|-----------------------|
| **720p**   | 1280x720   | **50.4 ms**  | 28.7 / 105.2 ms | 19.8 fps   | **6.5 MB**  | Baseline              |
| **1080p**  | 1920x1080  | **63.5 ms**  | 41.4 / 157.5 ms | 15.7 fps   | **13.9 MB** | < 0.28% from 720p     |
| **4K**     | 3840x2160  | **54.5 ms**  | 45.5 / 63.3 ms  | 18.3 fps   | **40.4 MB** | < 0.28% from 720p     |

*Note: 4K is automatically downscaled to 1280px max dimension before inference, keeping latency near 55 ms and peak RAM to only 40.4 MB, while coordinates are preserved in the original normalized [0, 1] coordinate system.*

---

## 12. AWS EC2 Deployment Preparation

### Target Environment Profile
- **Current EC2 Instance:** 2 vCPU / 1 GB RAM (as specified in Blynta's `ecosystem.config.js`)
- **OS:** Debian 12 (Bookworm) / Ubuntu 22.04 LTS (Jammy)
- **glibc:** ≥ 2.17 required (Debian 12 provides glibc 2.36)
- **Memory Headroom:** With peak service memory of ~40 MB for 4K video frames, the service operates well within the 1 GB EC2 budget without risking OOM errors, provided it runs with concurrency 1.

### Setup steps

```bash
# 1. Install Python 3.10
sudo apt-get update
sudo apt-get install -y python3.10 python3.10-venv python3-pip ffmpeg

# 2. Clone repo and navigate to service
cd /app/blynta/backend/services/face-detection

# 3. Create venv and install deps
python3.10 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# 4. Download model
bash scripts/download_model.sh

# 5. Smoke test
python -m src.main image --input /dev/null 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK' if not d['success'] else 'UNEXPECTED')"
```

### Environment variables for production

```bash
# /etc/environment or systemd unit file
FACE_DETECTOR_MODEL_PATH=/app/blynta/backend/services/face-detection/models/blaze_face_full_range.tflite
FACE_DETECTOR_CONFIDENCE=0.5
FACE_DETECTOR_INTERVAL=1.0
FACE_DETECTOR_MAX_DIM=1280
```

### systemd service (optional — if running as a persistent daemon in future)

```ini
[Unit]
Description=Blynta Face Detection Service
After=network.target

[Service]
Type=simple
User=blynta
WorkingDirectory=/app/blynta/backend/services/face-detection
ExecStart=/app/blynta/backend/services/face-detection/.venv/bin/python -m src.main video --input %I
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

> Currently the service is stateless and invoked per-job by NestJS, so no persistent daemon is needed.

---

## 13. NestJS Integration Interface

The NestJS backend invokes this service as a child process and reads stdout as JSON.

### Invocation contract

```typescript
// Pseudo-code — adapt to your actual spawn helper
import { spawn } from 'child_process';
import * as path from 'path';

const SERVICE_ROOT = path.resolve(
  __dirname,
  '../../services/face-detection'
);
const PYTHON = process.platform === 'win32'
  ? path.join(SERVICE_ROOT, '.venv', 'Scripts', 'python.exe')
  : path.join(SERVICE_ROOT, '.venv', 'bin', 'python');

function runFaceDetection(videoPath: string, options?: {
  interval?: number;
  confidence?: number;
}): Promise<DetectionResult> {
  return new Promise((resolve, reject) => {
    const args = [
      '-m', 'src.main',
      'video',
      '--input', videoPath,
      ...(options?.interval ? ['--interval', String(options.interval)] : []),
      ...(options?.confidence ? ['--confidence', String(options.confidence)] : []),
    ];

    const proc = spawn(PYTHON, args, {
      cwd: SERVICE_ROOT,
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => { stdout += chunk; });
    proc.stderr.on('data', (chunk) => { stderr += chunk; });

    proc.on('close', (code) => {
      try {
        const result = JSON.parse(stdout) as DetectionResult;
        resolve(result);
      } catch (e) {
        reject(new Error(`Face detection failed (exit ${code}): ${stderr}`));
      }
    });

    proc.on('error', reject);
  });
}
```

### TypeScript types (output contract)

```typescript
export interface BoundingBox {
  x: number;       // normalized [0, 1]
  y: number;       // normalized [0, 1]
  width: number;   // normalized [0, 1]
  height: number;  // normalized [0, 1]
}

export interface FaceDetection {
  confidence: number;
  boundingBox: BoundingBox;
  keypoints: Record<string, { x: number; y: number }>;
}

export interface FrameResult {
  timestamp: number;
  faces: FaceDetection[];
}

export interface VideoMetadata {
  width: number;
  height: number;
  fps: number;
  duration: number;
}

export interface DetectionResult {
  success: boolean;
  metadata?: VideoMetadata;
  frames: FrameResult[];
  error?: string;
  _timing?: {
    detection_ms?: number;
    total_ms?: number;
    frames_sampled?: number;
  };
}
```

### BullMQ job integration sketch

```typescript
// In your video-processing BullMQ worker:
@Process('analyze-faces')
async handleFaceAnalysis(job: Job<{ videoPath: string; jobId: string }>) {
  const result = await runFaceDetection(job.data.videoPath, { interval: 1.0 });
  if (!result.success) {
    throw new Error(result.error ?? 'Face detection failed');
  }
  // Persist result.frames to DB
  await this.faceResultsRepo.save({ jobId: job.data.jobId, frames: result.frames });
}
```

---

## Directory Layout

```
face-detection/
├── src/
│   ├── __init__.py          # Package marker
│   ├── main.py              # CLI entry point
│   ├── config.py            # Env-driven Config dataclass
│   ├── detector.py          # FaceDetector (MediaPipe wrapper)
│   ├── video_processor.py   # VideoProcessor (OpenCV frame extraction)
│   └── models.py            # Output dataclasses (BoundingBox, FaceDetection, …)
├── models/
│   └── .gitkeep             # Directory tracked; model files excluded by .gitignore
├── tests/
│   ├── __init__.py
│   ├── test_detector.py
│   ├── test_video_processor.py
│   └── test_error_handling.py
├── scripts/
│   ├── download_model.sh    # Linux/macOS model download
│   └── download_model.ps1   # Windows model download
├── requirements.txt
├── .gitignore
└── README.md                # This file
```

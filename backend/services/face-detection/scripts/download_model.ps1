# Download the BlazeFace Full-Range TFLite model for MediaPipe.
# Source: https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_full_range/float16/1/blaze_face_full_range.tflite
# License: Apache 2.0 (Commercial use permitted)
#
# Usage: .\scripts\download_model.ps1 [-ModelsDir path\to\models]

param(
    [string]$ModelsDir = "$PSScriptRoot\..\models"
)

$ModelName = "blaze_face_short_range.tflite"
$ModelUrl = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite"
$Dest = Join-Path $ModelsDir $ModelName

if (-Not (Test-Path $ModelsDir)) {
    New-Item -ItemType Directory -Path $ModelsDir | Out-Null
}

if (Test-Path $Dest) {
    Write-Host "Model already exists: $Dest"
    exit 0
}

Write-Host "Downloading $ModelName ..."
Invoke-WebRequest -Uri $ModelUrl -OutFile $Dest -UseBasicParsing
Write-Host "Downloaded: $Dest"
Write-Host "File size: $((Get-Item $Dest).Length / 1KB) KB"

$ExpectedHash = "b4578f35940bf5a1a655214a1cce5cab13eba73c1297cd78e1a04c2380b0152f"
$ActualHash = (Get-FileHash $Dest -Algorithm SHA256).Hash.ToLower()
if ($ActualHash -ne $ExpectedHash) {
    Write-Warning "SHA-256 hash mismatch! Expected: $ExpectedHash, Got: $ActualHash"
} else {
    Write-Host "SHA-256 integrity verified: $ActualHash"
}
Write-Host ""
Write-Host "Done. Set FACE_DETECTOR_MODEL_PATH=$Dest or use --model flag."

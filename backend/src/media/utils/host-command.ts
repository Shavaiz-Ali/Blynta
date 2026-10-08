import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { workerConcurrency } from '../../jobs/jobs.constants';

// The lock is held by the command supervisor, not the Node worker. If Node
// crashes, an orphaned FFmpeg still occupies its slot until it actually exits.
const linuxGate = `
set -eu
root="$1"; slots="$2"; deadline="$3"; shift 3
mkdir -p "$root"
while true; do
  for ((slot=0; slot<slots; slot++)); do
    (
      exec 9>"$root/slot-$slot.lock"
      flock -n 9 || exit 75
      timeout --foreground --signal=TERM --kill-after=5s "$deadline" "$@" && exit 0
      result=$?
      if [ "$result" -eq 75 ]; then exit 74; fi
      exit "$result"
    ) && exit 0
    result=$?
    if [ "$result" -ne 75 ]; then exit "$result"; fi
  done
  sleep 0.1
done`;

// Named kernel mutexes provide the same cross-process gate for Windows dev.
const windowsGate = `
$ErrorActionPreference = 'Stop'
$p = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:BLYNTA_GATE_PAYLOAD)) | ConvertFrom-Json
while ($true) {
  for ($i = 0; $i -lt $p.slots; $i++) {
    $m = [Threading.Mutex]::new($false, "Global\\blynta-media-$($p.namespace)-$i")
    $held = $false
    try {
      try { $held = $m.WaitOne(0) } catch [Threading.AbandonedMutexException] { $held = $true }
      if ($held) { $commandArgs = @($p.args); & $p.command @commandArgs; exit $LASTEXITCODE }
    } finally { if ($held) { $m.ReleaseMutex() }; $m.Dispose() }
  }
  Start-Sleep -Milliseconds 100
}`;

export function hostCommand(command: string, args: string[]) {
  const slots = workerConcurrency(
    process.env.MEDIA_HOST_CONCURRENCY,
    'MEDIA_HOST_CONCURRENCY',
  );
  const threads = workerConcurrency(
    process.env.FFMPEG_THREADS,
    'FFMPEG_THREADS',
  );
  const root =
    process.env.MEDIA_HOST_LOCK_DIR || join(tmpdir(), 'blynta-media-slots');
  const deadline = Number(process.env.MEDIA_COMMAND_TIMEOUT_SECONDS ?? 1800);
  if (!Number.isInteger(deadline) || deadline < 1 || deadline > 86400)
    throw new Error(
      'MEDIA_COMMAND_TIMEOUT_SECONDS must be an integer between 1 and 86400',
    );
  let limitedArgs = args;
  if (/^ffmpeg(?:\.exe)?$/i.test(basename(command))) {
    // Input decoder, filter pools and output encoder are independent thread pools.
    limitedArgs = [
      '-threads',
      String(threads),
      '-filter_threads',
      String(threads),
      '-filter_complex_threads',
      String(threads),
      ...args.slice(0, -1),
      '-threads',
      String(threads),
      ...args.slice(-1),
    ];
  }
  if (process.platform === 'linux') {
    return {
      command: 'bash',
      args: [
        '-c',
        linuxGate,
        'blynta-media',
        root,
        String(slots),
        String(deadline),
        command,
        ...limitedArgs,
      ],
    };
  }
  if (process.platform === 'win32') {
    const payload = Buffer.from(
      JSON.stringify({
        command,
        args: limitedArgs,
        slots,
        namespace: createHash('sha256').update(root).digest('hex').slice(0, 20),
      }),
    ).toString('base64');
    return {
      command: 'powershell.exe',
      args: [
        '-NoProfile',
        '-NonInteractive',
        '-EncodedCommand',
        Buffer.from(windowsGate, 'utf16le').toString('base64'),
      ],
      env: { ...process.env, BLYNTA_GATE_PAYLOAD: payload },
    };
  }
  throw new Error(
    'Media host coordination requires Linux (bash/flock) or Windows (PowerShell)',
  );
}

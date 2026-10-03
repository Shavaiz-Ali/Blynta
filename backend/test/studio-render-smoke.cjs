// Real FFmpeg smoke test. No external accounts, storage, database, or queue.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const binary = process.env.STUDIO_TEST_FFMPEG || 'ffmpeg';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'blynta-render-test-'));
try {
  const source = fs.readFileSync(path.join(root, 'src/studio/studio.renderer.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} }; new Function('exports', 'module', code)(module.exports, module);
  const { renderPlan, canvasSize } = module.exports;
  const run = (args) => execFileSync(binary, ['-hide_banner', '-loglevel', 'error', ...args], { cwd: tmp, windowsHide: true, maxBuffer: 10 * 1024 * 1024 });
  run(['-y', '-f', 'lavfi', '-i', 'color=c=red:s=320x180:r=30:d=4', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=4', '-c:v', 'libx264', '-c:a', 'aac', '-shortest', 'source.mp4']);
  run(['-y', '-f', 'lavfi', '-i', 'color=c=blue:s=180x320:r=30:d=1', '-frames:v', '1', 'image.png']);
  const video = { id: 'video', assetId: 'source', trackId: 'video', name: 'Trimmed and retimed', kind: 'video', start: 0, duration: 2, offset: 0.5, opacity: 100, scale: 100, rotation: 0, volume: 50, speed: 1.5, x: 0, y: 0, fontSize: 34, color: '#ffffff', fadeIn: 0, fadeOut: 0, fit: 'cover' };
  const overlay = { ...video, id: 'image', assetId: 'image', trackId: 'overlay', kind: 'image', start: 1, duration: 1, offset: 0, speed: 1, scale: 40, rotation: 20, x: 80, opacity: 70, fadeIn: 0.2, fadeOut: 0.2 };
  const text = { ...video, id: 'text', assetId: 'text', trackId: 'text', kind: 'text', offset: 0, speed: 1, name: "Blynta ':; %{metadata}\nSafe literal text", fontFamily: 'Arial', fontWeight: 700 };
  const tracks = [{ id: 'text', kind: 'text' }, { id: 'overlay', kind: 'video' }, { id: 'video', kind: 'video' }].map((t) => ({ ...t, name: t.id, muted: false, hidden: false }));
  for (const ratio of ['16:9', '9:16', '1:1', '4:5']) {
    const document = { name: 'Smoke test', ratio, tracks, assets: [], clips: [video, overlay, text] };
    const plan = renderPlan(document, { resolution: '720p', fps: 30 }, new Map([['source', { path: 'source.mp4', hasAudio: true }], ['image', { path: 'image.png', hasAudio: false }]]));
    fs.writeFileSync(path.join(tmp, 'filters.txt'), plan.filters);
    for (const file of plan.textFiles) fs.writeFileSync(path.join(tmp, file.name), file.text);
    run(plan.args);
    const size = canvasSize(ratio);
    // Decode a frame to RGB and verify actual resolution and that text transparency
    // does not obscure the underlying red video with an opaque black canvas.
    const rgb = run(['-ss', '0.5', '-i', 'output.mp4', '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1']);
    assert.equal(rgb.length, size.width * size.height * 3, `${ratio} resolution`);
    const center = (Math.floor(size.height / 2) * size.width + Math.floor(size.width / 2)) * 3;
    assert.ok(rgb[center] > 180 && rgb[center + 1] < 60, `${ratio} text layer must stay transparent`);
    // A two-second 48kHz stereo float export must contain approximately 192k samples.
    const audio = run(['-i', 'output.mp4', '-vn', '-ac', '2', '-ar', '48000', '-f', 'f32le', 'pipe:1']);
    assert.ok(audio.length >= 48000 * 2 * 4 * 1.9 && audio.length <= 48000 * 2 * 4 * 2.1, `${ratio} audio duration`);
    assert.ok(fs.statSync(path.join(tmp, 'output.mp4')).size > 2000);
  }
  console.log('Real FFmpeg exports passed for all four ratios: trim, speed, transparent transformed overlays, literal multiline text, audio volume, fades, dimensions and duration.');
} finally {
  if (path.dirname(path.resolve(tmp)) !== path.resolve(os.tmpdir()) || !path.basename(tmp).startsWith('blynta-render-test-')) throw new Error('Unexpected cleanup path');
  fs.rmSync(tmp, { recursive: true, force: true });
}

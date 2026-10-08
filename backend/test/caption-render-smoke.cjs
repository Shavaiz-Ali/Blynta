const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const {
  CaptionBurningService,
} = require('../dist/src/media/services/caption-burning.service');
(async () => {
  const root = path.resolve(
    process.env.MEDIA_CAPTION_QA_DIR || path.join(__dirname, '../../.media-qa'),
  );
  fs.mkdirSync(root, { recursive: true });
  const input = path.join(root, 'input.mp4');
  execFileSync('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'lavfi',
    '-i',
    'color=c=0x172033:s=360x640:d=2:r=12',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-y',
    input,
  ]);
  const service = new CaptionBurningService({
    assertRunning() {},
    register() {},
  });
  const cases = [
    ['english', 'Readable English captions — punctuation & 50%'],
    ['urdu', 'یہ اردو کا ایک خوبصورت جملہ ہے'],
    ['hindi', 'यह हिंदी में एक सुंदर वाक्य है'],
    ['mixed-hindi', 'English और हिंदी साथ में पढ़ें'],
    ['mixed-urdu', 'English اور اردو ایک ساتھ'],
    [
      'long',
      'Long captions should wrap within the vertical frame without touching the edges. Every word should remain readable, including punctuation!',
    ],
  ];
  cases.push([
    'long-hindi',
    'यह एक लंबा हिंदी वाक्य है ताकि हम देख सकें कि कैप्शन सही तरीके से कई पंक्तियों में दिखते हैं और वीडियो के किनारे पर कटते नहीं हैं।',
  ]);
  cases.push([
    'long-urdu',
    'یہ ایک لمبا اردو جملہ ہے تاکہ ہم دیکھ سکیں کہ کیپشن کئی سطروں میں درست طریقے سے دکھائی دیتے ہیں اور ویڈیو کے کنارے سے باہر نہیں جاتے',
  ]);
  cases.push([
    'punctuation',
    'Braces {literal}, slash \\N, café & 50% — quotes',
  ]);
  const { STYLE_PRESETS } = require('../dist/src/media/style-presets');
  const { EDITOR_STYLES } = require('../dist/src/media/editor-styles');
  for (const [name, preset] of Object.entries({
    ...STYLE_PRESETS,
    ...EDITOR_STYLES,
  }))
    cases.push([
      'style-' + name,
      'Readable captions stay inside the vertical frame.',
      preset.captionStyle,
    ]);
  for (const [name, text, style] of cases) {
    const out = path.join(root, name + '.mp4');
    await service.burnCaptions(
      input,
      [{ startTime: 0, endTime: 2, text }],
      out,
      style,
      2,
    );
    execFileSync('ffmpeg', [
      '-hide_banner',
      '-loglevel',
      'error',
      '-ss',
      '1',
      '-i',
      out,
      '-frames:v',
      '1',
      '-y',
      path.join(root, name + '.png'),
    ]);
    const frame = execFileSync('ffmpeg', [
      '-hide_banner',
      '-loglevel',
      'error',
      '-ss',
      '1',
      '-i',
      out,
      '-frames:v',
      '1',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgb24',
      'pipe:1',
    ]);
    let minX = 360,
      minY = 640,
      maxX = -1,
      maxY = -1;
    for (let i = 0; i < frame.length; i += 3) {
      if (frame[i] + frame[i + 1] + frame[i + 2] <= 350) continue;
      const x = (i / 3) % 360,
        y = Math.floor(i / 3 / 360);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    if (maxX < 0 || minX < 15 || minY < 15 || maxX >= 345 || maxY >= 625)
      throw new Error(`${name}: captions missing or outside safe frame bounds`);
    console.log(
      name + ': actual MP4 rendered; visible captions inside safe margins',
    );
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

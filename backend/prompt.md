BACKEND PROMPT — Core video clipping pipeline (yt-dlp → Whisper → LLM highlight detection → ffmpeg), with transcription and captioning built as standalone reusable services

CONTEXT:
- NestJS backend, existing modules: UsersModule, AuthModule, JobsModule, MailModule, BillingModule (Stripe) — follow their existing conventions (schema/service/controller/module pattern, ConfigService for all secrets, Logger for structured logging).
- Job schema exists at src/jobs/schemas/job.schema.ts with JobStatus enum (PENDING, TRANSCRIBING, DETECTING_HIGHLIGHTS, CUTTING_CLIPS, COMPLETED, FAILED), TranscriptSegment, Highlight, and Clip subdocuments — READ this file first, extend only if a field is genuinely missing (see Task 1).
- BullMQ + Redis already configured — follow the exact registerQueue/Processor pattern already used in src/mail/mail.processor.ts (read it as your reference for queue/processor structure).
- UsersService.deductCredit(userId) already exists (atomic $inc with balance check) — reuse it, do not reimplement.
- Storage: VPS LOCAL DISK for this task (e.g. /var/blynta/storage/) — not Cloudinary/S3/R2, deferred to a later task.
- Budget constraint: only ONE paid API call exists in this entire pipeline — the highlight-detection LLM call (Task 6). Video download, transcription, and clip cutting/caption burning must be fully self-hosted/free (yt-dlp, whisper.cpp, ffmpeg).

===========================================
ARCHITECTURAL REQUIREMENT — read before starting
===========================================

Transcription and caption generation must NOT be built as private logic buried inside a single "process the job" method. Build them as INDEPENDENT, STANDALONE SERVICES with their own clear input/output contracts, so they can be:
(a) reused inside this job pipeline, AND
(b) exposed later as standalone features/tools in their own right (e.g. a future "just transcribe this video" tool, or a future "just add captions to my existing video" tool, unrelated to the clip-highlight pipeline).

Concretely this means:
- TranscriptionService's public method must take ONLY an audio file path and return ONLY a transcript — it must know nothing about Jobs, MongoDB, or the clipping pipeline. It is a pure "audio in, transcript out" service.
- CaptionBurningService's public method must take ONLY a video file path + a transcript (or a subset of transcript segments) and return ONLY a captioned video file path — it must know nothing about Jobs, highlights, or credits. It is a pure "video + transcript in, captioned video out" service.
- The JobsModule's own processor/orchestration code is what WIRES these together with job-specific concerns (updating Job.status, saving Job.transcript, deducting credits) — that orchestration logic lives in the processor, NOT inside the reusable services themselves.
- This mirrors clean separation of concerns: reusable domain services vs. job-specific orchestration.

===========================================
TASK 1 — Schema additions
===========================================

Read src/jobs/schemas/job.schema.ts fully first. Add these fields only if not already present (use existing names if they already exist, tell me what you found instead of duplicating):

On Job:
  @Prop() localVideoPath: string;      // e.g. /var/blynta/storage/jobs/<jobId>/source.mp4
  @Prop() localAudioPath: string;      // e.g. /var/blynta/storage/jobs/<jobId>/audio.wav
  @Prop() customPrompt: string;        // optional, Pro/Business only — see Task 6
  @Prop({ default: 'default' }) aiModel: string; // 'default' for free tier, specific model string for paid tiers — see Task 6

On the Clip subdocument:
  @Prop() localFilePath: string;       // e.g. /var/blynta/storage/jobs/<jobId>/clips/clip-1.mp4
  @Prop() captionedFilePath: string;   // path AFTER caption burning — separate from the raw cut clip, see Task 7
  @Prop() downloadUrl: string;         // URL the frontend uses to fetch/stream this clip — see Task 8

===========================================
TASK 2 — System tools setup (document as VPS setup instructions, do not npm-install these)
===========================================

- yt-dlp: pip install -U yt-dlp — verify with yt-dlp --version
- ffmpeg: sudo apt install ffmpeg — verify with ffmpeg -version
- whisper.cpp: build from source (https://github.com/ggerganov/whisper.cpp), using the multilingual "base" GGML model (NOT base.en — our audience needs Hinglish/Urdu/English support, per product positioning). Document exact build commands, and tell me the resulting binary path (verify against whisper.cpp's current README — the binary name/location has changed across versions, e.g. ./main vs ./build/bin/whisper-cli — do not guess an outdated path, flag this explicitly as something to verify once built).

Node packages:
- npm install fluent-ffmpeg (programmatic ffmpeg command building, safer than hand-built shell strings)
- npm install -D @types/fluent-ffmpeg
- npm install openai (OpenAI-compatible SDK, used ONLY in Task 6 for the highlight-detection LLM call)

===========================================
TASK 3 — VideoDownloadService (standalone: yt-dlp + audio extraction)
===========================================

Create src/media/services/video-download.service.ts (new top-level "media" module — see Task 9 for why this lives outside JobsModule):

@Injectable()
export class VideoDownloadService {
  private readonly logger = new Logger(VideoDownloadService.name);
  constructor(private configService: ConfigService) {}

  // Pure function: takes a URL and an output directory, returns file paths. Knows NOTHING about Jobs.
  async downloadVideo(sourceUrl: string, outputDir: string): Promise<{ videoPath: string; audioPath: string }> {
    await fs.promises.mkdir(outputDir, { recursive: true });
    const videoPath = path.join(outputDir, 'source.mp4');
    const audioPath = path.join(outputDir, 'audio.wav');

    await this.runCommand('yt-dlp', [
      '-f', 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
      '--merge-output-format', 'mp4',
      '-o', videoPath,
      sourceUrl,
    ]);

    await this.runCommand('ffmpeg', [
      '-i', videoPath,
      '-ar', '16000',
      '-ac', '1',
      '-c:a', 'pcm_s16le',
      audioPath,
    ]);

    return { videoPath, audioPath };
  }

  private runCommand(command: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args);
      let stderr = '';
      proc.stderr.on('data', (d) => (stderr += d.toString()));
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`${command} exited with code ${code}: ${stderr.slice(-500)}`));
      });
    });
  }
}

Use Node's built-in child_process.spawn and fs/path — no extra dependencies here. Errors (private/deleted/age-restricted video) must throw clear messages that calling code can catch and translate into a FAILED job status.

===========================================
TASK 4 — TranscriptionService (standalone: whisper.cpp wrapper)
===========================================

Create src/media/services/transcription.service.ts:

export interface TranscriptSegmentDto {
  startTime: number; // seconds
  endTime: number;   // seconds
  text: string;
}

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);
  private readonly whisperBinaryPath: string;
  private readonly whisperModelPath: string;

  constructor(private configService: ConfigService) {
    this.whisperBinaryPath = this.configService.get<string>('WHISPER_BINARY_PATH');
    this.whisperModelPath = this.configService.get<string>('WHISPER_MODEL_PATH');
  }

  // Pure function: audio file path in, transcript segments out. Knows NOTHING about Jobs or MongoDB.
  // This must be independently callable/testable — e.g. `transcriptionService.transcribe('/tmp/some-audio.wav')`
  // should work standalone, with no Job context required, so it can later power a standalone "transcribe this file" tool.
  async transcribe(audioPath: string): Promise<TranscriptSegmentDto[]> {
    const outputBase = audioPath.replace(/\.wav$/, '');

    await this.runWhisper([
      '-m', this.whisperModelPath,
      '-f', audioPath,
      '-oj',
      '-of', outputBase,
      '-l', 'auto',
    ]);

    const rawJson = await fs.promises.readFile(`${outputBase}.json`, 'utf-8');
    const parsed = JSON.parse(rawJson);

    // VERIFY this mapping against the ACTUAL installed whisper.cpp version's JSON output —
    // field names (offsets.from/to vs t0/t1, ms vs centiseconds, "text" field name) vary by version.
    // Do not assume the shape below is correct without checking real output first.
    return parsed.transcription.map((seg: any) => ({
      startTime: seg.offsets.from / 1000,
      endTime: seg.offsets.to / 1000,
      text: seg.text.trim(),
    }));
  }

  private runWhisper(args: string[]): Promise<void> {
    // identical spawn-based pattern to VideoDownloadService.runCommand — implement the same way
  }
}

IMPORTANT: run whisper.cpp manually on a test file first (I will do this on the VPS) and share the real JSON structure if it differs from the assumption above — do not invent field names.

===========================================
TASK 5 — CaptionBurningService (standalone: ffmpeg caption overlay)
===========================================

Create src/media/services/caption-burning.service.ts:

@Injectable()
export class CaptionBurningService {
  private readonly logger = new Logger(CaptionBurningService.name);

  // Pure function: a video file + transcript segments (already time-offset to match the clip's own 0-based timeline,
  // NOT the original video's timeline — the caller is responsible for offsetting timestamps before calling this,
  // since this service has no concept of "the original video" at all) in, a captioned video file path out.
  // Knows NOTHING about Jobs, Highlights, or credits.
  async burnCaptions(
    inputVideoPath: string,
    segments: TranscriptSegmentDto[],
    outputVideoPath: string,
  ): Promise<string> {
    const srtPath = inputVideoPath.replace(/\.mp4$/, '.srt');
    const srtContent = this.buildSrt(segments);
    await fs.promises.writeFile(srtPath, srtContent, 'utf-8');

    await this.burnWithFfmpeg(inputVideoPath, srtPath, outputVideoPath);
    return outputVideoPath;
  }

  // Converts segments into standard SRT subtitle format:
  // 1
  // 00:00:00,000 --> 00:00:03,500
  // Text of the first segment
  private buildSrt(segments: TranscriptSegmentDto[]): string {
    return segments
      .map((seg, i) => {
        const start = this.formatSrtTime(seg.startTime);
        const end = this.formatSrtTime(seg.endTime);
        return `${i + 1}\n${start} --> ${end}\n${seg.text}\n`;
      })
      .join('\n');
  }

  private formatSrtTime(totalSeconds: number): string {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    const ms = Math.floor((totalSeconds % 1) * 1000);
    const pad = (n: number, len = 2) => String(n).padStart(len, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
  }

  private burnWithFfmpeg(videoPath: string, srtPath: string, outputPath: string): Promise<void> {
    // Use fluent-ffmpeg here, applying the subtitles filter, e.g.:
    // ffmpeg(videoPath).outputOptions([`-vf subtitles=${srtPath}:force_style='FontSize=24,PrimaryColour=&HFFFFFF&'`]).save(outputPath)
    // Verify fluent-ffmpeg's exact API for applying a complex filter string like this — check its README/types
    // rather than assuming a method name, since filter syntax via fluent-ffmpeg can be finicky with escaping.
  }
}

===========================================
TASK 6 — HighlightDetectionService (the one paid API call)
===========================================

Create src/media/services/highlight-detection.service.ts:

export interface HighlightDto {
  startTime: number;
  endTime: number;
  reason: string;
  score: number; // 0 to 1
}

@Injectable()
export class HighlightDetectionService {
  private readonly logger = new Logger(HighlightDetectionService.name);
  private client: OpenAI;

  constructor(private configService: ConfigService) {
    this.client = new OpenAI({ apiKey: this.configService.get<string>('LLM_API_KEY') });
  }

  // Pure function: transcript segments in, ranked highlight timestamps out. No Job/Mongo knowledge.
  async detectHighlights(
    segments: TranscriptSegmentDto[],
    options?: { customPrompt?: string; model?: string },
  ): Promise<HighlightDto[]> {
    const model = options?.model || this.configService.get<string>('LLM_DEFAULT_MODEL', 'gpt-4o-mini');
    const transcriptText = segments.map((s) => `[${s.startTime.toFixed(1)}s] ${s.text}`).join('\n');

    const systemPrompt = `You are a video editor's assistant. Given a timestamped transcript, identify the 3-5 most engaging, self-contained moments suitable for short vertical clips (15-60 seconds each). Return ONLY valid JSON matching this exact shape, no other text:
[{"startTime": number, "endTime": number, "reason": "short string explaining why", "score": number between 0 and 1}]`;

    const userPrompt = options?.customPrompt
      ? `${options.customPrompt}\n\nTranscript:\n${transcriptText}`
      : `Transcript:\n${transcriptText}`;

    const response = await this.client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' }, // VERIFY this exact param name/support against the model chosen — not all models support forced JSON mode identically, check current OpenAI SDK docs for the model you actually configure
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) throw new Error('LLM returned no content for highlight detection');

    // The model may wrap the array in an object (e.g. { "highlights": [...] }) depending on prompt/JSON mode behavior —
    // handle both a bare array and a wrapped object defensively, log the raw response if parsing fails so we can debug real output shape.
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      this.logger.error(`Failed to parse LLM response as JSON: ${raw}`);
      throw new Error('LLM returned invalid JSON for highlight detection');
    }
    return Array.isArray(parsed) ? parsed : parsed.highlights || parsed.data || [];
  }
}

Plan-gating logic (which model/customPrompt a user is allowed to use) belongs in the JobsModule orchestration layer (Task 9), NOT inside this service — this service just accepts whatever model/customPrompt it's given and trusts the caller to have already validated plan permissions.

===========================================
TASK 7 — ClipCuttingService (standalone: ffmpeg cut + vertical crop)
===========================================

Create src/media/services/clip-cutting.service.ts:

@Injectable()
export class ClipCuttingService {
  // Pure function: source video + a start/end time range in, a cut+cropped vertical clip file out.
  async cutClip(
    sourceVideoPath: string,
    startTime: number,
    endTime: number,
    outputPath: string,
  ): Promise<string> {
    // Use fluent-ffmpeg: seek to startTime, set duration to (endTime - startTime),
    // apply a crop+scale filter to convert to 9:16 vertical (e.g. crop=ih*9/16:ih,scale=1080:1920 —
    // verify this exact filter chain produces correct output by testing manually, center-cropping is a
    // reasonable default but note this doesn't do smart subject-tracking — that's a future enhancement, not in scope here).
    // Save to outputPath.
  }
}

===========================================
TASK 8 — Serving clip files to the frontend
===========================================

Add a simple static file serving route or a dedicated download endpoint (your call, justify which): either (a) NestJS serve-static module pointing at the storage directory with a public /media/ prefix, protected by checking the requesting user owns the job (don't just expose the whole storage folder publicly — verify job ownership before serving, similar to the existing getJobById ownership check pattern), or (b) a GET /jobs/:jobId/clips/:clipId/download endpoint that streams the file with proper ownership checks, reusing the existing JobsService.getJobById ownership-check pattern. Recommend option (b) since it's consistent with existing auth patterns already in this codebase — implement it using NestJS's StreamableFile response type.

===========================================
TASK 9 — Orchestration: wiring it together in JobsModule
===========================================

Create a new top-level MediaModule (src/media/media.module.ts) that provides VideoDownloadService, TranscriptionService, CaptionBurningService, HighlightDetectionService, ClipCuttingService, and EXPORTS all of them — this module has no Job/Mongo knowledge at all, it's purely reusable media-processing tools.

In JobsModule, import MediaModule. Create src/jobs/jobs.processor.ts (a BullMQ Processor, following the exact pattern in src/mail/mail.processor.ts) that:
1. Injects JobsService (for status updates) and all five MediaModule services.
2. Injects UsersService (for deductCredit and plan-checking).
3. On processing a 'clip-video' job (queued from JobsService.createJob — add this queue call following the same registerQueue pattern as the 'mail' queue), runs this exact sequence, updating Job.status at each step:
   a. Set status PENDING → call VideoDownloadService.downloadVideo, save localVideoPath/localAudioPath
   b. Set status TRANSCRIBING → call TranscriptionService.transcribe(localAudioPath), save the result to Job.transcript
   c. Set status DETECTING_HIGHLIGHTS → look up the user's plan; if FREE, call HighlightDetectionService.detectHighlights(transcript) with no custom options; if PRO/BUSINESS, pass job.customPrompt and job.aiModel if the user provided them (validate aiModel against an allowlist of permitted paid models — do not let users pass an arbitrary string to the LLM API unchecked). Save results to Job.highlights.
   d. Set status CUTTING_CLIPS → for each highlight, call ClipCuttingService.cutClip to produce the raw vertical clip, then call CaptionBurningService.burnCaptions using the subset of transcript segments whose timestamps fall within that highlight's range (offset them to start at 0 relative to the clip, since CaptionBurningService expects clip-relative timestamps per Task 5's note). Save each result as a Clip subdocument with localFilePath, captionedFilePath, and a downloadUrl pointing at the Task 8 endpoint.
   e. Set status COMPLETED. If any step throws, catch it, set status FAILED with a descriptive errorMessage and errorStage (matching the existing schema field), and log the full error server-side.
4. Credit deduction: call UsersService.deductCredit(userId) at job creation time (in JobsService.createJob, before queuing), not after processing completes — consistent with "this job costs 1 credit to attempt," not "1 credit only if it succeeds" (flag this choice explicitly in your summary — I want to confirm this matches my intent, since the alternative — refunding credits on failure — is also reasonable and worth discussing, but implement pre-deduction for now as the simpler default).

CONSTRAINTS:
- Every file path used anywhere in this pipeline must be built with Node's path module, never string concatenation, to avoid path bugs.
- Every external command execution (yt-dlp, ffmpeg, whisper.cpp) must go through the same spawn-based pattern with proper error capture — do not use exec() with string-interpolated shell commands, which is a command-injection risk given sourceUrl is user input.
- Add cleanup logic (or at least a TODO comment with a clear plan) for deleting a job's local files after some retention period — we are on limited VPS disk, unbounded accumulation will fill the disk. Don't build the actual cleanup cron in this task, just flag it clearly as necessary follow-up work.
- Do not touch AuthModule, BillingModule, or MailModule.

At the end, give me:
1. Final directory structure of src/media/ and the modified src/jobs/.
2. Confirmation of the credit-deduction timing decision (Task 9.4) and whether you implemented it as specified or flagged a concern.
3. A clear list of everything that needs manual verification on the actual VPS before this can be trusted (whisper.cpp output shape, ffmpeg filter chain correctness, binary paths) — since several parts of this prompt explicitly called out assumptions that need real-world confirmation, not blind trust.
4. Confirmation that TranscriptionService, CaptionBurningService, and the other MediaModule services are genuinely callable independently of any Job context, proving the reusability requirement was met.
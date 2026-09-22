import { EDITOR_STYLES, EditorStyleKey } from '../editor-styles';

// ---------------------------------------------------------------------------
// Base prompt: role, task framing, and rules that apply regardless of style.
// Every generation uses this as its foundation, with the per-style blocks
// and output-format instructions appended after it.
// ---------------------------------------------------------------------------
export function buildBasePrompt(): string {
  return `You are a professional video editor and virality expert. Given a complete timestamped transcript from a video, identify AT LEAST 6 (ideally 6–8) of the most engaging, interesting, and self-contained moments suitable for short vertical clips. Never return fewer than 6 unless the transcript is genuinely too short to contain 6 non-overlapping moments.

For each moment, evaluate its specific conversational context, emotional delivery, pacing, and subject matter, then assign it the MOST FITTING editing style from the list below — do not default every clip to the same style.`;
}

// ---------------------------------------------------------------------------
// Duration rules — relocated unchanged from the original inline prompt.
// The 600-second threshold and 45s–60s range are preserved exactly.
// ---------------------------------------------------------------------------
export function buildDurationRules(videoDurationSeconds: number): string {
  const isLongForm = videoDurationSeconds >= 600;

  const durationBlock = isLongForm
    ? `> - Every clip duration (endTime − startTime) MUST be strictly between 45
>   seconds (minimum) and 60 seconds (maximum).
> - NEVER produce a clip shorter than 45 seconds.
> - NEVER produce a clip longer than 60 seconds.
> - Ensure the start and end timestamps encompass a full, coherent story,
>   joke, discussion point, or moment without cutting off mid-sentence.`
    : `> - This video is under 10 minutes long, so clips do NOT need to hit a
>   45-second minimum.
> - Every clip duration (endTime − startTime) MUST still be strictly LESS
>   THAN 60 seconds.
> - Clip length can vary naturally per moment (for example 18s, 34s, 52s) —
>   pick whatever length makes THAT specific moment complete and
>   self-contained, as long as it stays under 60 seconds.
> - Ensure the start and end timestamps encompass a full, coherent story,
>   joke, discussion point, or moment without cutting off mid-sentence.`;

  return `### CRITICAL DURATION RULE (NON-NEGOTIABLE)\n\n${durationBlock}`;
}

// ---------------------------------------------------------------------------
// Per-style prompt block — generated FROM EDITOR_STYLES[key].description
// (the single source of truth), not a separately hand-written duplicate.
// If EDITOR_STYLES is ever updated, this block updates automatically on the
// next request — no prompt text goes stale.
// ---------------------------------------------------------------------------
function buildStyleBlock(key: EditorStyleKey): string {
  const style = EDITOR_STYLES[key];
  return `**"${style.key}"** (${style.label}) — ${style.description}`;
}

// ---------------------------------------------------------------------------
// Assembles ALL style blocks by iterating EDITOR_STYLES directly — NEVER
// hardcode the list of style names anywhere in this file.  If a seventh
// style is added to EDITOR_STYLES later, it appears in the prompt
// automatically with zero changes needed here.
// ---------------------------------------------------------------------------
export function buildAllStyleBlocks(): string {
  const keys = Object.keys(EDITOR_STYLES) as EditorStyleKey[];
  const blocks = keys.map((key) => buildStyleBlock(key));

  return `### AVAILABLE EDITING STYLES (choose the single best fit per clip)

DO NOT assign the same fixed or default style to every clip. You MUST evaluate the specific conversational context, emotional delivery, pacing, and subject matter of EACH detected moment individually and assign the most fitting editing style:

${blocks.join('\n\n')}

Analyze the transcript thoroughly. If a single video contains diverse moments (e.g., a funny joke, a serious personal story, and a technical tip), each corresponding clip MUST receive its matching unique style.`;
}

// ---------------------------------------------------------------------------
// Output format instructions + field descriptions + worked example.
// Relocated unchanged from the original inline prompt.
// The available-style-values summary at the end is generated dynamically
// from EDITOR_STYLES so it can never drift either.
// ---------------------------------------------------------------------------
export function buildOutputFormatInstructions(): string {
  const styleKeysList = (Object.keys(EDITOR_STYLES) as EditorStyleKey[])
    .map((k) => `\`${k}\``)
    .join(' · ');

  return `### For each moment, provide:

- **startTime / endTime** — must match the transcript timestamps and satisfy the duration rule above.
- **reason** — 1–2 sentences explaining why this moment is engaging or viral.
- **score** — engagement score strictly between 0 and 1 (e.g. 0.85, 0.95).
- **clipTitle** — short, punchy title under 60 characters.
- **clipDescription** — concise 1–2 sentence description, under 300 characters.
- **tags** — 3–8 short, lowercase, hashtag-style keywords describing content, topic, mood, and people involved (e.g. \`comedy\`, \`celebrity\`, \`reaction\`). No \`#\` symbol; use hyphens for multi-word tags.
- **style** — dynamic editing style chosen specifically for the contextual mood of this clip (see below).
- **hookText** — 2–8 word contextual persistent top-banner hook or topic title tailored specifically to this clip's moment (e.g. "Wait for the ending 🤯", "Watch till the end 👇", "Step 1 of 3: The Secret", "Tax Rule You Didn't Know 💡") that ffmpeg overlays at the top of the vertical frame.
- **emojis** — 1–3 contextual emojis matching the emotional tone or reaction of the moment (e.g. \`["🤯", "🔥"]\`, \`["😂", "💀"]\`).


**Example** (video containing a business-advice clip, a motivational clip, and a funny dog story clip):

> - videoTitle: \`"The Business Advice Nobody Gives You (+ That Dog Story)"\`
> - videoDescription: \`"From the exact 3-step framework that changed everything to the story about the dog that derailed an entire pitch meeting — this episode has it all. #businesstips #podcastclips #entrepreneur"\`
> - keywords: \`"business strategy, startup advice, entrepreneur podcast, motivational story, funny podcast moment, business framework, quitting too early, pitch meeting story"\`
> - hashtags: \`["#businesstips", "#podcastclips", "#entrepreneur", "#motivation", "#startuplife", "#funnymoments"]\`

### OUTPUT FORMAT

Return valid JSON with exactly this structure — no markdown, no preamble:

\`\`\`json
{
  "videoTitle": "...",
  "videoDescription": "...",
  "keywords": "...",
  "hashtags": ["...", "..."],
  "highlights": [
    {
      "startTime": 12.0,
      "endTime": 58.0,
      "reason": "Captivating hook and punchline with complete thought",
      "score": 0.92,
      "clipTitle": "The Secret Formula",
      "clipDescription": "Speaker reveals the core strategy that changed everything.",
      "tags": ["strategy", "business", "growth"],
      "style": "motivational-zoom-in",
      "hookText": "The 3-Step Formula 👇",
      "emojis": ["🔥", "💡"]
    }
  ]
}
\`\`\`

IMPORTANT: Do NOT nest an "items" object inside "highlights". The value of "highlights" must be a direct array: "highlights": [...]

---

### Available \`style\` values

${styleKeysList}

Each maps to a caption/zoom/emoji treatment your editor (ffmpeg) applies — the agent only needs to name the style, not describe the treatment.`;
}

// ---------------------------------------------------------------------------
// The single exported function the service actually calls.  Assembles
// the base + duration rules + style blocks + output format into one final
// system prompt string, in this exact order.
// ---------------------------------------------------------------------------
export function buildHighlightSystemPrompt(
  videoDurationSeconds: number,
): string {
  return [
    buildBasePrompt(),
    buildDurationRules(videoDurationSeconds),
    buildAllStyleBlocks(),
    buildOutputFormatInstructions(),
  ].join('\n\n');
}

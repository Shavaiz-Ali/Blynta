import { z } from 'zod';
import {
  EDITOR_STYLES,
  EditorStyleKey,
  DEFAULT_EDITOR_STYLE_KEY,
} from './editor-styles';
// Zod needs a literal tuple of string values for z.enum(), not a plain
// string[] — this line derives that tuple from EDITOR_STYLES' actual keys
// at runtime/compile-time, so the enum can NEVER drift from what
// EDITOR_STYLES actually defines:
const EDITOR_STYLE_KEYS = Object.keys(EDITOR_STYLES) as [
  EditorStyleKey,
  ...EditorStyleKey[],
];

export const HighlightSchema = z.object({
  contextComplete: z.boolean().optional().default(false),
  presetRelevant: z.boolean().optional().default(false),
  groundedQuote: z.string().max(300).optional().default(''),
  startTime: z.number().describe('Start time of the clip in seconds'),
  endTime: z.number().describe('End time of the clip in seconds'),
  reason: z
    .string()
    .max(300)
    .describe(
      'Short explanation of why this moment is engaging, 1-2 sentences',
    ),
  score: z
    .number()
    .describe(
      'Engagement score strictly between 0 and 1, e.g. 0.5, 0.82, 0.95. NEVER use a 0-10 or 0-100 scale.',
    )
    .transform((val) => {
      if (val > 1 && val <= 10) return val / 10;
      if (val > 10 && val <= 100) return val / 100;
      return val;
    })
    .pipe(z.number().min(0).max(1)),
  clipTitle: z
    .string()
    .max(80)
    .describe(
      'Short, punchy title under 60 characters, like a social media caption',
    ),
  clipDescription: z
    .string()
    .max(400)
    .describe(
      '1-2 sentence description explaining what makes this moment worth watching',
    ),
  tags: z
    .array(z.string().max(30))
    .optional()
    .default([])
    .describe(
      'List of 3-8 short, lowercase keywords or hashtag-style tags describing the clip content, topic, mood, and people involved (e.g. "comedy", "celebrity", "reaction"). No # symbol, use hyphens if a tag needs multiple words.',
    ),
  style: z
    .enum(EDITOR_STYLE_KEYS)
    .optional()
    .default(DEFAULT_EDITOR_STYLE_KEY)
    .describe(
      "Editing style selected based on this specific clip's context — see system prompt for the full list and criteria.",
    ),
  hookText: z
    .string()
    .max(100)
    .optional()
    .default('')
    .describe(
      'Contextual top-banner hook / overlay text for ffmpeg (e.g. "Wait for the end 🤯", "Watch till the end 👇", "Step 1 of 3", "The truth about startups")',
    ),
  emojis: z
    .array(z.string().max(10))
    .optional()
    .default([])
    .describe(
      '1-3 contextual emojis that match this moment and amplify reaction (e.g. ["🤯", "🔥"])',
    ),
});

export const HighlightsResponseSchema = z.object({
  videoTitle: z
    .string()
    .max(150)
    .optional()
    .default('')
    .describe('Punchy, clickable title under 100 characters'),
  videoDescription: z
    .string()
    .max(600)
    .optional()
    .default('')
    .describe(
      '2-4 sentences, max 500 characters, naturally weaving in relevant keywords and hashtags',
    ),
  keywords: z
    .string()
    .max(600)
    .optional()
    .default('')
    .describe(
      'Comma-separated SEO keywords/phrases for the whole video, max 500 characters total',
    ),
  hashtags: z
    .array(z.string().max(50))
    .optional()
    .default([])
    .describe('5-15 hashtags, each starting with #, lowercase, no spaces'),
  highlights: z.array(HighlightSchema),
});

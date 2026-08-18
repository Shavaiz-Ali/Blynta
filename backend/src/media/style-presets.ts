export interface CaptionStyleConfig {
  fontFamily: string;
  fontSize: number;
  primaryColor: string; // ASS &HAABBGGRR format
  outlineColor: string;
  highlightColor?: string; // used only if animation === 'karaoke'
  position: 'bottom' | 'center' | 'top';
  animation: 'none' | 'word-pop' | 'karaoke';
}

export interface StylePreset {
  key: string;
  label: string;
  isPro: boolean; // gates the highlightPrompt only, NOT captionStyle
  highlightPrompt: string; // '' means "use the base system prompt only, no extra bias"
  captionStyle: CaptionStyleConfig;
}

export const STYLE_PRESETS: Record<string, StylePreset> = {
  default: {
    key: 'default',
    label: 'Simple',
    isPro: false,
    highlightPrompt: '',
    captionStyle: {
      fontFamily: 'Montserrat',
      fontSize: 64,
      primaryColor: '&H00FFFFFF',
      outlineColor: '&H00000000',
      position: 'bottom',
      animation: 'none',
    },
  },
  meme: {
    key: 'meme',
    label: 'Meme / Funny',
    isPro: true,
    highlightPrompt:
      'Prioritize funny, ironic, or meme-worthy reaction moments, punchlines, ' +
      'and unexpected twists over purely dramatic or informational ones.',
    captionStyle: {
      fontFamily: 'Impact',
      fontSize: 72,
      primaryColor: '&H0000FFFF',
      outlineColor: '&H00000000',
      position: 'center',
      animation: 'word-pop',
    },
  },
  sad: {
    key: 'sad',
    label: 'Emotional',
    isPro: true,
    highlightPrompt:
      'Prioritize vulnerable, emotional, or heartfelt moments — quiet, sincere ' +
      'confessions and reflective statements over loud, comedic, or high-energy ones.',
    captionStyle: {
      fontFamily: 'Georgia',
      fontSize: 56,
      primaryColor: '&H00E6E6E6',
      outlineColor: '&H00000000',
      position: 'bottom',
      animation: 'none',
    },
  },
  motivational: {
    key: 'motivational',
    label: 'Motivational',
    isPro: true,
    highlightPrompt:
      'Prioritize inspiring, empowering, or high-energy statements — moments ' +
      'framed as advice, calls to action, or overcoming adversity.',
    captionStyle: {
      fontFamily: 'Montserrat',
      fontSize: 68,
      primaryColor: '&H0000D7FF',
      outlineColor: '&H00000000',
      position: 'bottom',
      animation: 'word-pop',
    },
  },
};

export const DEFAULT_STYLE_PRESET_KEY = 'default';

export function resolveStylePreset(key: string | undefined): StylePreset {
  return STYLE_PRESETS[key ?? DEFAULT_STYLE_PRESET_KEY] ?? STYLE_PRESETS[DEFAULT_STYLE_PRESET_KEY];
}

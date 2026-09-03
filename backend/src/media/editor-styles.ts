import { CaptionStyleConfig } from './style-presets';

export type EditorStyleKey =
  | 'curiosity-hook'
  | 'fixed-caption-clean'
  | 'meme-zoom-pop'
  | 'emotional-ken-burns'
  | 'motivational-zoom-in'
  | 'emoji-reaction';

export interface EditorStyleConfig {
  key: EditorStyleKey;
  label: string;
  description: string;
  captionStyle: CaptionStyleConfig;
  videoTreatment?: 'none' | 'zoom-in' | 'ken-burns' | 'punch-zoom';
}

export const EDITOR_STYLES: Record<EditorStyleKey, EditorStyleConfig> = {
  'curiosity-hook': {
    key: 'curiosity-hook',
    label: 'Curiosity Hook',
    description:
      'Opens by withholding information and teasing what is coming; classic retention hook.',
    captionStyle: {
      fontFamily: 'Montserrat',
      fontSize: 64,
      primaryColor: '&H00FFFFFF',
      outlineColor: '&H00000000',
      position: 'bottom',
      animation: 'word-pop',
    },
    videoTreatment: 'none',
  },
  'fixed-caption-clean': {
    key: 'fixed-caption-clean',
    label: 'Fixed Caption Clean',
    description:
      'Dense informational content reads better with one steady caption than fast-changing text.',
    captionStyle: {
      fontFamily: 'Montserrat',
      fontSize: 58,
      primaryColor: '&H00FFFFFF',
      outlineColor: '&H00000000',
      position: 'bottom',
      animation: 'none',
    },
    videoTreatment: 'none',
  },
  'meme-zoom-pop': {
    key: 'meme-zoom-pop',
    label: 'Meme Zoom Pop',
    description:
      'Physical-comedy punchline; fast captions and a zoom on the punchline land the joke.',
    captionStyle: {
      fontFamily: 'Impact',
      fontSize: 72,
      primaryColor: '&H0000FFFF',
      outlineColor: '&H00000000',
      position: 'center',
      animation: 'word-pop',
    },
    videoTreatment: 'punch-zoom',
  },
  'emotional-ken-burns': {
    key: 'emotional-ken-burns',
    label: 'Emotional Ken Burns',
    description:
      'Vulnerable, sincere disclosure; slow drift, no emojis, quiet captions.',
    captionStyle: {
      fontFamily: 'Georgia',
      fontSize: 56,
      primaryColor: '&H00E6E6E6',
      outlineColor: '&H00000000',
      position: 'bottom',
      animation: 'none',
    },
    videoTreatment: 'ken-burns',
  },
  'motivational-zoom-in': {
    key: 'motivational-zoom-in',
    label: 'Motivational Zoom In',
    description:
      'Direct call to action / advice; builds intensity toward the key line.',
    captionStyle: {
      fontFamily: 'Montserrat',
      fontSize: 68,
      primaryColor: '&H0000D7FF',
      outlineColor: '&H00000000',
      position: 'bottom',
      animation: 'word-pop',
    },
    videoTreatment: 'zoom-in',
  },
  'emoji-reaction': {
    key: 'emoji-reaction',
    label: 'Emoji Reaction',
    description:
      'High-energy reaction moment; emojis amplify the reaction without needing a zoom.',
    captionStyle: {
      fontFamily: 'Montserrat',
      fontSize: 66,
      primaryColor: '&H0000FFFF',
      outlineColor: '&H00000000',
      position: 'center',
      animation: 'word-pop',
    },
    videoTreatment: 'none',
  },
};

export const DEFAULT_EDITOR_STYLE_KEY: EditorStyleKey = 'curiosity-hook';

export function resolveEditorStyle(key: string | undefined): EditorStyleConfig {
  if (key && key in EDITOR_STYLES) {
    return EDITOR_STYLES[key as EditorStyleKey];
  }
  return EDITOR_STYLES[DEFAULT_EDITOR_STYLE_KEY];
}

export type AspectRatio = "16:9" | "9:16" | "1:1" | "4:5";
export type AssetKind = "video" | "audio" | "image" | "text";
export interface Asset {
  id: string;
  name: string;
  kind: AssetKind;
  duration: number;
  src?: string;
  status?: string;
  transcriptStatus?: string;
  error?: string;
  thumbnail?: string;
  width?: number;
  height?: number;
  hasAudio?: boolean;
  sourceGroup?:
    "Original source" | "Generated clips" | "Uploads" | "Audio" | "Images";
  sourceProjectId?: string;
  generatedClipId?: string;
  origin: "Blynta demo" | "Blynta" | "Upload" | "Text";
}
export interface Clip {
  id: string;
  assetId: string;
  trackId: string;
  name: string;
  kind: AssetKind;
  start: number;
  duration: number;
  offset: number;
  opacity: number;
  scale: number;
  rotation: number;
  volume: number;
  speed: number;
  x: number;
  y: number;
  fontSize: number;
  fontFamily?: string;
  fontWeight?: number;
  textAlign?: "left" | "center" | "right";
  letterSpacing?: number;
  color: string;
  fadeIn: number;
  fadeOut: number;
  fit: "contain" | "cover";
}
export interface Track {
  locked?: boolean;
  id: string;
  name: string;
  kind: AssetKind;
  muted: boolean;
  hidden: boolean;
}
export interface Project {
  revision?: number;
  version?: number;
  source?: "Studio" | "Blynta Clip" | "Blynta Job" | "Imported";
  id: string;
  name: string;
  ratio: AspectRatio;
  updatedAt: string;
  assets: Asset[];
  clips: Clip[];
  tracks: Track[];
  demo: boolean;
}
export interface EditorDocument {
  name: string;
  ratio: AspectRatio;
  assets: Asset[];
  clips: Clip[];
  tracks: Track[];
}
export type AIAction =
  | { type: "trim"; seconds: number; targetClipId?: string }
  | { type: "ratio"; ratio: AspectRatio }
  | { type: "captions"; segments?: { start: number; end: number; text: string }[] }
  | { type: "volume"; volume: number; targetClipId?: string };
export interface AIProposal {
  id: string;
  prompt: string;
  actions: AIAction[];
  descriptions: string[];
  applied: boolean;
  discarded?: boolean;
  scope?: "project" | "clip";
  targetClipId?: string;
}

export type AIMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  proposal?: AIProposal;
};
export type AIEditProposal = AIProposal;
export type AIEditAction = AIAction;

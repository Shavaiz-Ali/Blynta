export type RenderStatus =
  "queued" | "processing" | "completed" | "failed" | "cancelled";
export interface StudioOperation {
  id: string;
  type: string;
  start: number;
  end: number;
  enabled: boolean;
  params: Record<string, string | number | boolean>;
}
export interface AudioTrack {
  id: string;
  role: string;
  assetId: string;
  start: number;
  sourceStart: number;
  sourceEnd: number;
  gain: number;
  enabled: boolean;
  fadeIn: number;
  fadeOut: number;
}
export interface OriginalAudio {
  gain: number;
  enabled: boolean;
  fadeIn: number;
  fadeOut: number;
  mutes: { start: number; end: number }[];
  automation: { time: number; gain: number }[];
}
export type PatchChange =
  | {
      action: "add" | "update";
      operation: StudioOperation;
      operationId?: string;
    }
  | { action: "remove" | "enable" | "disable"; operationId: string }
  | {
      action: "add_audio_track" | "update_audio_track";
      track: AudioTrack;
      trackId?: string;
    }
  | {
      action:
        "remove_audio_track" | "enable_audio_track" | "disable_audio_track";
      trackId: string;
    }
  | { action: "update_original_audio"; controls: OriginalAudio };
export interface EditingPlan {
  latestPreview?: { status: RenderStatus; revision: number } | null;
  _id: string;
  sourceClipId: string;
  sourceJobId: string;
  revision: number;
  status: string;
  outputDuration: number;
  updatedAt: string;
  plan: {
    operations: StudioOperation[];
    audio: { tracks: AudioTrack[]; original: OriginalAudio };
  };
}
export interface EditingVersion {
  _id: string;
  planId: string;
  revision: number;
  status: RenderStatus;
  progress?: number;
  createdAt: string;
  outputUrl?: string;
  error?: string;
  errorCode?: string;
  retryable?: boolean;
  renderStats?: {
    duration: number;
    width: number;
    height: number;
    bytes: number;
  };
}
export interface Proposal {
  _id: string;
  planId: string;
  sessionId: string;
  requestId: string;
  baseRevision: number;
  status:
    | "generating"
    | "pending"
    | "applying"
    | "applied"
    | "rejected"
    | "failed"
    | "clarification"
    | "unsupported";
  summary: string;
  createdAt: string;
  patch?: { baseRevision: number; changes: PatchChange[] };
}
export interface AgentSession {
  _id: string;
  planId: string;
  selectedModelId?: string;
}
export interface StudioState {
  session: AgentSession | null;
  proposals: Proposal[];
}
export interface StudioMessage {
  _id: string;
  role: "user" | "assistant";
  content: string;
  proposalId?: string;
}
export interface StudioAsset {
  _id: string;
  assetId: string;
  name: string;
  kind: "audio" | "image";
  mimeType: string;
  duration?: number;
}
export interface PromptSubmission {
  planId: string;
  prompt: string;
  requestId: string;
  modelId?: string;
  sessionId?: string;
}

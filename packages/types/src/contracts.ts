/** Public, persisted identifiers. Keep serialized values compatible across deployments. */
export enum JobStatus {
  PENDING = "pending",
  TRANSCRIBING = "transcribing",
  DETECTING_HIGHLIGHTS = "detecting_highlights",
  CUTTING_CLIPS = "cutting_clips",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLING = "cancelling",
  CANCELLED = "cancelled",
}
export enum SourcePlatform {
  YOUTUBE = "youtube",
  TIKTOK = "tiktok",
  INSTAGRAM = "instagram",
  UPLOAD = "upload",
}
export enum ClipProcessingState {
  QUEUED = "queued",
  CUTTING = "cutting",
  CAPTIONING = "captioning",
  UPLOADING = "uploading",
  READY = "ready",
  CANCELLED = "cancelled",
  FAILED = "failed",
}
export const AI_TASK = {
  HIGHLIGHT_DETECTION: "highlight_detection",
  EDIT_PLANNING: "edit_planning",
  EDIT_REFINEMENT: "edit_refinement",
} as const;
export const AI_TASKS = [
  AI_TASK.HIGHLIGHT_DETECTION,
  AI_TASK.EDIT_PLANNING,
  AI_TASK.EDIT_REFINEMENT,
] as const;
export type AITask = (typeof AI_TASKS)[number];
export const AI_TASK_LABELS: Record<AITask, string> = {
  highlight_detection: "Highlight detection",
  edit_planning: "Edit planning",
  edit_refinement: "Edit refinement",
};
export const AI_ADAPTERS = ["google", "openai", "anthropic"] as const;
export type AIAdapterType = (typeof AI_ADAPTERS)[number];
export const AI_ERROR_CODES = {
  AUTH_FAILED: "AI_AUTH_FAILED",
  AUTH_OR_ACCESS_FAILED: "AI_AUTH_OR_ACCESS_FAILED",
  MODEL_UNAVAILABLE: "AI_MODEL_UNAVAILABLE",
  QUOTA_OR_RATE_LIMIT: "AI_QUOTA_OR_RATE_LIMIT",
  PROVIDER_FAILED: "AI_PROVIDER_FAILED",
  CREDENTIAL_DECRYPT_FAILED: "AI_CREDENTIAL_DECRYPT_FAILED",
  TIMEOUT: "AI_TIMEOUT",
  NETWORK_FAILED: "AI_NETWORK_FAILED",
  UNSUPPORTED_ADAPTER: "AI_UNSUPPORTED_ADAPTER",
  UNSAFE_ENDPOINT: "AI_UNSAFE_ENDPOINT",
  REQUEST_FAILED: "AI_REQUEST_FAILED",
  PROPOSAL_FAILED: "AI_PROPOSAL_FAILED",
  EXECUTION_INTERRUPTED: "AI_EXECUTION_INTERRUPTED",
} as const;
export type AIErrorCode = (typeof AI_ERROR_CODES)[keyof typeof AI_ERROR_CODES];
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 25,
  MAX_PAGE_SIZE: 100,
  MAX_PAGE: 10000,
} as const;
export const AI_MODEL_POLICY = {
  TEMPERATURE: { MIN: 0, MAX: 2 },
  OUTPUT_TOKENS: { MIN: 128, MAX: 8192, DEFAULT: 4096 },
  TIMEOUT_MS: { MIN: 1000, MAX: 60000, DEFAULT: 30000 },
  PRIORITY: { MIN: 0, MAX: 1000, DEFAULT: 100 },
  MAX_TOKEN_PRICE_USD: 10000,
  MAX_RETRIES: 0,
} as const;
export const HTTP_STATUS = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const;
export enum UserPlan {
  FREE = "free",
  PRO = "pro",
  BUSINESS = "business",
}
export type SubscriptionPlan = `${UserPlan}`;
export const SUBSCRIPTION_PLANS: readonly [
  SubscriptionPlan,
  SubscriptionPlan,
  SubscriptionPlan,
] = [UserPlan.FREE, UserPlan.PRO, UserPlan.BUSINESS];
export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  pending: "Queued",
  transcribing: "Generating transcript",
  detecting_highlights: "Detecting highlights",
  cutting_clips: "Rendering clips",
  completed: "Completed",
  failed: "Failed",
  cancelling: "Cancelling",
  cancelled: "Cancelled",
};
const id = (value: string) => encodeURIComponent(value);
export const API_ENDPOINTS = {
  ai: { availableModels: "/ai/models/available" },
  aiAdmin: {
    root: "/admin/ai/",
    adapters: "/admin/ai/adapters",
    providers: "/admin/ai/providers",
    models: "/admin/ai/models",
    usage: "/admin/ai/usage",
    credentials: (providerId: string) =>
      `/admin/ai/providers/${id(providerId)}/credentials`,
  },
  jobs: {
    list: "/jobs",
    detail: (jobId: string) => `/jobs/${id(jobId)}`,
    retry: (jobId: string) => `/jobs/${id(jobId)}/retry`,
  },
  editor: {
    plans: "/ai-editor/plans",
    assets: "/ai-editor/assets",
    initialize: "/ai-editor/initialize",
    plan: (planId: string) => `/ai-editor/plans/${id(planId)}`,
    versions: (planId: string) => `/ai-editor/plans/${id(planId)}/versions`,
    version: (versionId: string) => `/ai-editor/versions/${id(versionId)}`,
    versionAction: (
      versionId: string,
      action: "cancel" | "retry" | "download",
    ) => `/ai-editor/versions/${id(versionId)}/${action}`,
    preview: (planId: string) => `/ai-editor/plans/${id(planId)}/preview`,
    proposals: (clipId: string) => `/clips/${id(clipId)}/ai-edit/proposals`,
    proposal: (clipId: string, proposalId: string) =>
      `/clips/${id(clipId)}/ai-edit/proposals/${id(proposalId)}`,
    proposalAction: (
      clipId: string,
      proposalId: string,
      action: "apply" | "reject" | "cancel",
    ) => `/clips/${id(clipId)}/ai-edit/proposals/${id(proposalId)}/${action}`,
    propose: (clipId: string) => `/clips/${id(clipId)}/ai-edit/propose`,
    session: (clipId: string, sessionId: string) =>
      `/clips/${id(clipId)}/ai-edit/sessions/${id(sessionId)}`,
    state: (clipId: string, planId: string) =>
      `/clips/${id(clipId)}/ai-edit/state?planId=${id(planId)}`,
  },
} as const;
export const APP_ROUTES = {
  home: "/",
  clips: "/my-clips",
  aiStudio: "/studio",
  billing: "/billing",
  job: (jobId: string) => `/my-clips/${id(jobId)}`,
  clip: (jobId: string, clipId: string) =>
    `/my-clips/${id(jobId)}/clips/${id(clipId)}`,
} as const;
export const ADMIN_ROUTES = {
  home: "/",
  users: "/users",
  jobs: "/jobs",
  ai: "/ai",
  provider: "/ai/providers",
  models: "/ai/models",
  usage: "/ai/usage",
  user: (userId: string) => `/users/${id(userId)}`,
  job: (jobId: string) => `/jobs/${id(jobId)}`,
} as const;
/** Percentages describe encoding only; other stages are indeterminate. */
export const EDIT_RENDER_PHASE = {
  QUEUED: "queued",
  PREPARING: "preparing_assets",
  COMPILING: "compiling_plan",
  ENCODING: "encoding",
  VERIFYING: "verifying",
  UPLOADING: "uploading_preview",
  FINALIZING: "finalizing",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;
export type EditRenderPhase =
  (typeof EDIT_RENDER_PHASE)[keyof typeof EDIT_RENDER_PHASE];
export const EDIT_RENDER_PHASE_LABEL: Record<EditRenderPhase, string> = {
  queued: "Waiting to render",
  preparing_assets: "Preparing assets",
  compiling_plan: "Compiling edit plan",
  encoding: "Encoding video",
  verifying: "Verifying preview",
  uploading_preview: "Uploading preview",
  finalizing: "Finalizing preview",
  completed: "Preview ready",
  failed: "Preview failed",
  cancelled: "Preview canceled",
};
export const AI_EDIT_STAGE_LABEL: Record<string, string> = {
  load_context: "Checking available editing options…",
  interpret: "Understanding your request…",
  resolve_information: "Finding the requested moments…",
  resolve_assets: "Preparing requested assets…",
  generate_patch: "Building your edit proposal…",
  validate: "Checking your proposal…",
  correct: "Checking your proposal…",
};

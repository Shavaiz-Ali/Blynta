"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AI_EDIT_STAGE_LABEL = exports.EDIT_RENDER_PHASE_LABEL = exports.EDIT_RENDER_PHASE = exports.ADMIN_ROUTES = exports.APP_ROUTES = exports.API_ENDPOINTS = exports.JOB_STATUS_LABELS = exports.SUBSCRIPTION_PLANS = exports.UserPlan = exports.HTTP_STATUS = exports.AI_MODEL_POLICY = exports.PAGINATION = exports.AI_ERROR_CODES = exports.AI_ADAPTERS = exports.AI_TASK_LABELS = exports.AI_TASKS = exports.AI_TASK = exports.ClipProcessingState = exports.SourcePlatform = exports.JobStatus = void 0;
/** Public, persisted identifiers. Keep serialized values compatible across deployments. */
var JobStatus;
(function (JobStatus) {
    JobStatus["PENDING"] = "pending";
    JobStatus["TRANSCRIBING"] = "transcribing";
    JobStatus["DETECTING_HIGHLIGHTS"] = "detecting_highlights";
    JobStatus["CUTTING_CLIPS"] = "cutting_clips";
    JobStatus["COMPLETED"] = "completed";
    JobStatus["FAILED"] = "failed";
    JobStatus["CANCELLING"] = "cancelling";
    JobStatus["CANCELLED"] = "cancelled";
})(JobStatus || (exports.JobStatus = JobStatus = {}));
var SourcePlatform;
(function (SourcePlatform) {
    SourcePlatform["YOUTUBE"] = "youtube";
    SourcePlatform["TIKTOK"] = "tiktok";
    SourcePlatform["INSTAGRAM"] = "instagram";
    SourcePlatform["UPLOAD"] = "upload";
})(SourcePlatform || (exports.SourcePlatform = SourcePlatform = {}));
var ClipProcessingState;
(function (ClipProcessingState) {
    ClipProcessingState["QUEUED"] = "queued";
    ClipProcessingState["CUTTING"] = "cutting";
    ClipProcessingState["CAPTIONING"] = "captioning";
    ClipProcessingState["UPLOADING"] = "uploading";
    ClipProcessingState["READY"] = "ready";
    ClipProcessingState["CANCELLED"] = "cancelled";
    ClipProcessingState["FAILED"] = "failed";
})(ClipProcessingState || (exports.ClipProcessingState = ClipProcessingState = {}));
exports.AI_TASK = {
    HIGHLIGHT_DETECTION: "highlight_detection",
    EDIT_PLANNING: "edit_planning",
    EDIT_REFINEMENT: "edit_refinement",
};
exports.AI_TASKS = [
    exports.AI_TASK.HIGHLIGHT_DETECTION,
    exports.AI_TASK.EDIT_PLANNING,
    exports.AI_TASK.EDIT_REFINEMENT,
];
exports.AI_TASK_LABELS = {
    highlight_detection: "Highlight detection",
    edit_planning: "Edit planning",
    edit_refinement: "Edit refinement",
};
exports.AI_ADAPTERS = ["google", "openai", "anthropic"];
exports.AI_ERROR_CODES = {
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
};
exports.PAGINATION = {
    DEFAULT_PAGE: 1,
    DEFAULT_PAGE_SIZE: 25,
    MAX_PAGE_SIZE: 100,
    MAX_PAGE: 10000,
};
exports.AI_MODEL_POLICY = {
    TEMPERATURE: { MIN: 0, MAX: 2 },
    OUTPUT_TOKENS: { MIN: 128, MAX: 8192, DEFAULT: 4096 },
    TIMEOUT_MS: { MIN: 1000, MAX: 60000, DEFAULT: 30000 },
    PRIORITY: { MIN: 0, MAX: 1000, DEFAULT: 100 },
    MAX_TOKEN_PRICE_USD: 10000,
    MAX_RETRIES: 0,
};
exports.HTTP_STATUS = {
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
};
var UserPlan;
(function (UserPlan) {
    UserPlan["FREE"] = "free";
    UserPlan["PRO"] = "pro";
    UserPlan["BUSINESS"] = "business";
})(UserPlan || (exports.UserPlan = UserPlan = {}));
exports.SUBSCRIPTION_PLANS = [UserPlan.FREE, UserPlan.PRO, UserPlan.BUSINESS];
exports.JOB_STATUS_LABELS = {
    pending: "Queued",
    transcribing: "Generating transcript",
    detecting_highlights: "Detecting highlights",
    cutting_clips: "Rendering clips",
    completed: "Completed",
    failed: "Failed",
    cancelling: "Cancelling",
    cancelled: "Cancelled",
};
const id = (value) => encodeURIComponent(value);
exports.API_ENDPOINTS = {
    ai: { availableModels: "/ai/models/available" },
    aiAdmin: {
        root: "/admin/ai/",
        adapters: "/admin/ai/adapters",
        providers: "/admin/ai/providers",
        models: "/admin/ai/models",
        usage: "/admin/ai/usage",
        credentials: (providerId) => `/admin/ai/providers/${id(providerId)}/credentials`,
    },
    jobs: {
        list: "/jobs",
        detail: (jobId) => `/jobs/${id(jobId)}`,
        retry: (jobId) => `/jobs/${id(jobId)}/retry`,
    },
    editor: {
        plans: "/ai-editor/plans",
        assets: "/ai-editor/assets",
        initialize: "/ai-editor/initialize",
        plan: (planId) => `/ai-editor/plans/${id(planId)}`,
        versions: (planId) => `/ai-editor/plans/${id(planId)}/versions`,
        version: (versionId) => `/ai-editor/versions/${id(versionId)}`,
        versionAction: (versionId, action) => `/ai-editor/versions/${id(versionId)}/${action}`,
        preview: (planId) => `/ai-editor/plans/${id(planId)}/preview`,
        proposals: (clipId) => `/clips/${id(clipId)}/ai-edit/proposals`,
        proposal: (clipId, proposalId) => `/clips/${id(clipId)}/ai-edit/proposals/${id(proposalId)}`,
        proposalAction: (clipId, proposalId, action) => `/clips/${id(clipId)}/ai-edit/proposals/${id(proposalId)}/${action}`,
        propose: (clipId) => `/clips/${id(clipId)}/ai-edit/propose`,
        session: (clipId, sessionId) => `/clips/${id(clipId)}/ai-edit/sessions/${id(sessionId)}`,
        state: (clipId, planId) => `/clips/${id(clipId)}/ai-edit/state?planId=${id(planId)}`,
    },
};
exports.APP_ROUTES = {
    home: "/",
    clips: "/my-clips",
    aiStudio: "/studio",
    billing: "/billing",
    job: (jobId) => `/my-clips/${id(jobId)}`,
    clip: (jobId, clipId) => `/my-clips/${id(jobId)}/clips/${id(clipId)}`,
};
exports.ADMIN_ROUTES = {
    home: "/",
    users: "/users",
    jobs: "/jobs",
    ai: "/ai",
    provider: "/ai/providers",
    models: "/ai/models",
    usage: "/ai/usage",
    user: (userId) => `/users/${id(userId)}`,
    job: (jobId) => `/jobs/${id(jobId)}`,
};
/** Percentages describe encoding only; other stages are indeterminate. */
exports.EDIT_RENDER_PHASE = {
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
};
exports.EDIT_RENDER_PHASE_LABEL = {
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
exports.AI_EDIT_STAGE_LABEL = {
    load_context: "Checking available editing options…",
    interpret: "Understanding your request…",
    resolve_information: "Finding the requested moments…",
    resolve_assets: "Preparing requested assets…",
    generate_patch: "Building your edit proposal…",
    validate: "Checking your proposal…",
    correct: "Checking your proposal…",
};

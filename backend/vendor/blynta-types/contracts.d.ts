/** Public, persisted identifiers. Keep serialized values compatible across deployments. */
export declare enum JobStatus {
    PENDING = "pending",
    TRANSCRIBING = "transcribing",
    DETECTING_HIGHLIGHTS = "detecting_highlights",
    CUTTING_CLIPS = "cutting_clips",
    COMPLETED = "completed",
    FAILED = "failed",
    CANCELLING = "cancelling",
    CANCELLED = "cancelled"
}
export declare enum SourcePlatform {
    YOUTUBE = "youtube",
    TIKTOK = "tiktok",
    INSTAGRAM = "instagram",
    UPLOAD = "upload"
}
export declare enum ClipProcessingState {
    QUEUED = "queued",
    CUTTING = "cutting",
    CAPTIONING = "captioning",
    UPLOADING = "uploading",
    READY = "ready",
    CANCELLED = "cancelled",
    FAILED = "failed"
}
export declare const AI_TASK: {
    readonly HIGHLIGHT_DETECTION: "highlight_detection";
    readonly EDIT_PLANNING: "edit_planning";
    readonly EDIT_REFINEMENT: "edit_refinement";
};
export declare const AI_TASKS: readonly ["highlight_detection", "edit_planning", "edit_refinement"];
export type AITask = (typeof AI_TASKS)[number];
export declare const AI_TASK_LABELS: Record<AITask, string>;
export declare const AI_ADAPTERS: readonly ["google", "openai", "anthropic"];
export type AIAdapterType = (typeof AI_ADAPTERS)[number];
export declare const AI_ERROR_CODES: {
    readonly AUTH_FAILED: "AI_AUTH_FAILED";
    readonly AUTH_OR_ACCESS_FAILED: "AI_AUTH_OR_ACCESS_FAILED";
    readonly MODEL_UNAVAILABLE: "AI_MODEL_UNAVAILABLE";
    readonly QUOTA_OR_RATE_LIMIT: "AI_QUOTA_OR_RATE_LIMIT";
    readonly PROVIDER_FAILED: "AI_PROVIDER_FAILED";
    readonly CREDENTIAL_DECRYPT_FAILED: "AI_CREDENTIAL_DECRYPT_FAILED";
    readonly TIMEOUT: "AI_TIMEOUT";
    readonly NETWORK_FAILED: "AI_NETWORK_FAILED";
    readonly UNSUPPORTED_ADAPTER: "AI_UNSUPPORTED_ADAPTER";
    readonly UNSAFE_ENDPOINT: "AI_UNSAFE_ENDPOINT";
    readonly REQUEST_FAILED: "AI_REQUEST_FAILED";
    readonly PROPOSAL_FAILED: "AI_PROPOSAL_FAILED";
    readonly EXECUTION_INTERRUPTED: "AI_EXECUTION_INTERRUPTED";
};
export type AIErrorCode = (typeof AI_ERROR_CODES)[keyof typeof AI_ERROR_CODES];
export declare const PAGINATION: {
    readonly DEFAULT_PAGE: 1;
    readonly DEFAULT_PAGE_SIZE: 25;
    readonly MAX_PAGE_SIZE: 100;
    readonly MAX_PAGE: 10000;
};
export declare const AI_MODEL_POLICY: {
    readonly TEMPERATURE: {
        readonly MIN: 0;
        readonly MAX: 2;
    };
    readonly OUTPUT_TOKENS: {
        readonly MIN: 128;
        readonly MAX: 8192;
        readonly DEFAULT: 4096;
    };
    readonly TIMEOUT_MS: {
        readonly MIN: 1000;
        readonly MAX: 60000;
        readonly DEFAULT: 30000;
    };
    readonly PRIORITY: {
        readonly MIN: 0;
        readonly MAX: 1000;
        readonly DEFAULT: 100;
    };
    readonly MAX_TOKEN_PRICE_USD: 10000;
    readonly MAX_RETRIES: 0;
};
export declare const HTTP_STATUS: {
    readonly BAD_REQUEST: 400;
    readonly UNAUTHORIZED: 401;
    readonly FORBIDDEN: 403;
    readonly NOT_FOUND: 404;
    readonly CONFLICT: 409;
    readonly TOO_MANY_REQUESTS: 429;
    readonly INTERNAL_SERVER_ERROR: 500;
};
export declare enum UserPlan {
    FREE = "free",
    PRO = "pro",
    BUSINESS = "business"
}
export type SubscriptionPlan = `${UserPlan}`;
export declare const SUBSCRIPTION_PLANS: readonly [
    SubscriptionPlan,
    SubscriptionPlan,
    SubscriptionPlan
];
export declare const JOB_STATUS_LABELS: Record<JobStatus, string>;
export declare const API_ENDPOINTS: {
    readonly ai: {
        readonly availableModels: "/ai/models/available";
    };
    readonly aiAdmin: {
        readonly root: "/admin/ai/";
        readonly adapters: "/admin/ai/adapters";
        readonly providers: "/admin/ai/providers";
        readonly models: "/admin/ai/models";
        readonly usage: "/admin/ai/usage";
        readonly credentials: (providerId: string) => string;
    };
    readonly jobs: {
        readonly list: "/jobs";
        readonly detail: (jobId: string) => string;
        readonly retry: (jobId: string) => string;
    };
    readonly editor: {
        readonly plans: "/ai-editor/plans";
        readonly assets: "/ai-editor/assets";
        readonly initialize: "/ai-editor/initialize";
        readonly plan: (planId: string) => string;
        readonly versions: (planId: string) => string;
        readonly version: (versionId: string) => string;
        readonly versionAction: (versionId: string, action: "cancel" | "retry" | "download") => string;
        readonly preview: (planId: string) => string;
        readonly proposals: (clipId: string) => string;
        readonly proposal: (clipId: string, proposalId: string) => string;
        readonly proposalAction: (clipId: string, proposalId: string, action: "apply" | "reject" | "cancel") => string;
        readonly propose: (clipId: string) => string;
        readonly session: (clipId: string, sessionId: string) => string;
        readonly state: (clipId: string, planId: string) => string;
    };
};
export declare const APP_ROUTES: {
    readonly home: "/";
    readonly clips: "/my-clips";
    readonly aiStudio: "/studio";
    readonly billing: "/billing";
    readonly job: (jobId: string) => string;
    readonly clip: (jobId: string, clipId: string) => string;
};
export declare const ADMIN_ROUTES: {
    readonly home: "/";
    readonly users: "/users";
    readonly jobs: "/jobs";
    readonly ai: "/ai";
    readonly provider: "/ai/providers";
    readonly models: "/ai/models";
    readonly usage: "/ai/usage";
    readonly user: (userId: string) => string;
    readonly job: (jobId: string) => string;
};
/** Percentages describe encoding only; other stages are indeterminate. */
export declare const EDIT_RENDER_PHASE: {
    readonly QUEUED: "queued";
    readonly PREPARING: "preparing_assets";
    readonly COMPILING: "compiling_plan";
    readonly ENCODING: "encoding";
    readonly VERIFYING: "verifying";
    readonly UPLOADING: "uploading_preview";
    readonly FINALIZING: "finalizing";
    readonly COMPLETED: "completed";
    readonly FAILED: "failed";
    readonly CANCELLED: "cancelled";
};
export type EditRenderPhase = (typeof EDIT_RENDER_PHASE)[keyof typeof EDIT_RENDER_PHASE];
export declare const EDIT_RENDER_PHASE_LABEL: Record<EditRenderPhase, string>;
export declare const AI_EDIT_STAGE_LABEL: Record<string, string>;

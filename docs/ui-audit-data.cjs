// Synthetic UI fixtures only. No secrets, real users, or live service calls.
const ids = {
  user: "aaaaaaaaaaaaaaaaaaaaaaaa",
  job: "bbbbbbbbbbbbbbbbbbbbbbbb",
  clip: "cccccccccccccccccccccccc",
  plan: "dddddddddddddddddddddddd",
  model: "eeeeeeeeeeeeeeeeeeeeeeee",
  provider: "ffffffffffffffffffffffff",
  credential: "111111111111111111111111",
  proposal: "222222222222222222222222",
  session: "333333333333333333333333",
  version: "444444444444444444444444",
};
const date = "2026-10-10T08:00:00.000Z";
const user = {
  _id: ids.user,
  id: ids.user,
  email: "creator@example.test",
  name: "Sample Creator",
  role: "admin",
  plan: "pro",
  isActive: true,
  emailVerified: true,
  creditsBalance: 1000,
  totalCreditsUsed: 240,
  creditsResetAt: date,
  isWelcomed: true,
  referralCode: "AUDIT",
  linkedAccounts: [],
  createdAt: date,
  updatedAt: date,
};
const clip = {
  _id: ids.clip,
  id: ids.clip,
  startTime: 0,
  endTime: 18,
  status: "completed",
  hasCaptions: true,
  downloadUrl: "",
  createdAt: date,
};
const job = {
  _id: ids.job,
  id: ids.job,
  userId: user,
  userEmail: user.email,
  videoTitle: "How a small creative habit changes your day",
  sourceUrl: "https://youtube.com/watch?v=example",
  sourcePlatform: "youtube",
  status: "completed",
  sourceDuration: 600,
  videoDuration: 600,
  duration: 600,
  clips: [clip],
  highlights: [
    {
      startTime: 0,
      endTime: 18,
      clipTitle: "Make room for your next idea",
      reason: "A clear practical takeaway",
      score: 90,
      tags: [],
    },
  ],
  transcript: [
    {
      startTime: 0,
      endTime: 18,
      text: "Start with a small idea, and give it room to grow.",
    },
  ],
  createdAt: date,
  updatedAt: date,
  stylePreset: "default",
  progress: 100,
};
const original = {
  gain: 0.7,
  enabled: true,
  fadeIn: 0,
  fadeOut: 0,
  mutes: [],
  automation: [],
};
const operation = {
  id: "zoom-1",
  type: "zoom",
  enabled: true,
  start: 0,
  end: 3,
  params: { fromScale: 1, toScale: 1.2, x: 0.5, y: 0.5, easing: "easeInOut" },
};
const provider = {
  _id: ids.provider,
  code: "google",
  name: "Google AI",
  adapter: "google",
  enabled: true,
  configured: true,
  modelCount: 1,
  description: "Configured editing provider",
  defaultCredentialId: ids.credential,
};
const model = {
  _id: ids.model,
  providerId: ids.provider,
  modelId: "gemini-example",
  displayName: "Creator model",
  description: "A tested model for everyday edits",
  credentialId: ids.credential,
  enabled: true,
  isDefault: true,
  tasks: ["highlight_detection", "edit_planning", "edit_refinement"],
  capabilities: {
    text: true,
    vision: false,
    audioInput: false,
    structuredOutput: true,
    toolCalling: true,
  },
  settings: {
    temperature: 0.2,
    maxOutputTokens: 4096,
    timeoutMs: 30000,
    maxRetries: 0,
  },
  access: { allowedPlans: ["free", "pro", "business"], selectable: true },
  priority: 100,
  lastTestStatus: "passed",
  lastTestedAt: date,
};
const queues = ["media-processing", "media-rendering", "editing-previews"].map(
  (name, i) => ({
    name,
    label: ["Video pipeline", "Clip rendering", "Editing previews"][i],
    active: i + 1,
    waiting: 4,
    delayed: 1,
    completed: 128,
    failed: i === 1 ? 2 : 0,
    isHealthy: true,
    paused: false,
  }),
);
const audit = [
  {
    _id: "event-1",
    title: "Model configuration tested and approved for creator access",
    action: "ai.model.test",
    actorType: "admin",
    adminName: "Sample Administrator",
    adminEmail: "admin@example.test",
    category: "system",
    type: "configuration",
    status: "completed",
    severity: "info",
    reason: "UI fixture",
    description: "A provider connection was verified.",
    createdAt: date,
  },
];
const days = Array.from({ length: 14 }, (_, i) => ({
  date: `2026-09-${String(i + 15).padStart(2, "0")}`,
  total: 12 + (i % 5),
  completed: 10 + (i % 5),
  failed: i % 2,
  newUsers: i + 2,
  generated: 30 + i * 2,
}));
function fixture(path, method, body, scenario, state, port) {
  if (
    scenario === "offline" &&
    (path === "/ai-editor/initialize" ||
      path === "/ai/models/available" ||
      path === "/admin/dashboard" ||
      (path === "/users/me" && state.view === "profile"))
  )
    return {
      status: 503,
      data: {
        success: false,
        error: {
          message: "Cannot POST /ai-editor/initialize",
          code: "OFFLINE",
        },
      },
    };
  if (scenario === "source-offline" && path === `/jobs/${ids.job}`)
    return {
      status: 503,
      data: {
        success: false,
        error: { message: "Service unavailable", code: "OFFLINE" },
      },
    };
  const paginated = (data) => ({
    data,
    meta: { page: 1, limit: 25, total: data.length, totalPages: 1 },
  });
  const listed = (items) => ({ items, page: 1, pageSize: 25 });
  const video = `http://localhost:${port}/auth/ui-audit-video.mp4`;
  const plan = {
    _id: ids.plan,
    sourceClipId: ids.clip,
    sourceJobId: ids.job,
    revision: state.revision,
    status: "draft",
    outputDuration: 18,
    updatedAt: date,
    plan: {
      operations: state.revision > 0 ? [operation] : [],
      audio: { tracks: [], original },
    },
  };
  const proposal = {
    _id: ids.proposal,
    planId: ids.plan,
    sessionId: ids.session,
    requestId: "fixture-request",
    baseRevision: 0,
    status: state.proposalStatus,
    summary:
      "Add a gentle zoom during the opening three seconds, keeping the original audio.",
    createdAt: date,
    patch: { baseRevision: 0, changes: [{ action: "add", operation }] },
  };
  const version = {
    _id: ids.version,
    planId: ids.plan,
    revision: state.revision,
    status: state.rendered ? "completed" : "processing",
    progress: state.rendered ? 100 : 42,
    createdAt: date,
    outputUrl: state.rendered ? video : undefined,
    renderStats: { duration: 18, width: 720, height: 1280, bytes: 500000 },
  };
  let data;
  if (path === "/users/me")
    data = { ...user, plan: scenario === "free" ? "free" : "pro" };
  else if (path === "/billing/credits")
    data = {
      enabled: true,
      available: 1000,
      reserved: 0,
      plan: "pro",
      monthlyCredits: 1000,
      nextRenewal: date,
      pricing: {
        version: "fixture-v1",
        sourceSeconds: 300,
        outputSeconds: 60,
        studioSeconds: 60,
        studioModifier: 1,
        aiCredits: 1,
      },
    };
  else if (path === "/jobs/estimate")
    data = {
      enabled: true,
      totalCredits: 5,
      available: 1000,
      sourceSeconds: 600,
      maxOutputSeconds: 180,
      pricingVersion: "fixture-v1",
      sourceCredits: 2,
      renderCredits: 3,
      clipTargetMin: 2,
      clipTargetMax: 3,
      sourceTitle: job.videoTitle,
    };
  else if (path === "/style-presets")
    data = [
      { key: "default", label: "Simple", isPro: false },
      { key: "meme", label: "Meme / Funny", isPro: true },
      { key: "emotional", label: "Emotional", isPro: false },
      { key: "motivational", label: "Motivational", isPro: false },
    ];
  else if (path === "/ai/models/available")
    data = {
      plan: scenario === "free" ? "free" : "pro",
      selectionAllowed: scenario !== "free",
      defaultModelId: ids.model,
      models: [
        {
          id: ids.model,
          displayName: model.displayName,
          provider: provider.name,
          description: model.description,
          selectable: true,
        },
      ],
    };
  else if (path === "/jobs" && method === "POST") {
    state.jobsPayload = body;
    data = job;
  } else if (path === "/jobs")
    data = {
      jobs: [{ ...job, clips: [{ ...clip, outputUrl: video }] }],
      total: 1,
      totalPages: 1,
      page: 1,
      limit: 12,
    };
  else if (path.endsWith("/media-url")) data = { signedUrl: video };
  else if (path === `/jobs/${ids.job}`)
    data = { ...job, clips: [{ ...clip, outputUrl: video }] };
  else if (
    path === "/ai-editor/initialize" ||
    path === `/ai-editor/plans/${ids.plan}`
  )
    data = plan;
  else if (path === "/ai-editor/plans")
    data = {
      items: [
        {
          ...plan,
          latestPreview: state.rendered
            ? { status: "completed", revision: state.revision }
            : null,
        },
      ],
    };
  else if (path.endsWith("/ai-edit/state"))
    data = {
      session: { _id: ids.session, planId: ids.plan },
      proposals: [proposal],
    };
  else if (path.includes("/ai-edit/sessions/"))
    data = {
      messages: [
        {
          _id: "message-1",
          role: "user",
          content: "Give the opening a gentle zoom.",
        },
        {
          _id: "message-2",
          role: "assistant",
          content:
            "I’ve prepared one change for you to review. Your original audio will stay in place.",
        },
      ],
    };
  else if (path.endsWith("/ai-edit/propose")) {
    state.promptPayload = body;
    state.proposalStatus = "pending";
    data = proposal;
  } else if (path.endsWith("/apply")) {
    state.revision = 1;
    state.proposalStatus = "applied";
    data = { ...plan, revision: 1 };
  } else if (path.endsWith("/reject")) {
    state.proposalStatus = "rejected";
    data = { ...proposal, status: "rejected" };
  } else if (path.includes("/ai-edit/proposals/")) data = proposal;
  else if (path.endsWith("/render-preview") || path.endsWith("/preview")) {
    state.rendered = true;
    data = { ...version, status: "completed", outputUrl: video };
  } else if (path.endsWith("/versions") || path.endsWith("/versions?"))
    data = { items: state.rendered ? [version] : [], page: 1 };
  else if (path.endsWith("/download"))
    data = { signedUrl: `${video}?download=1`, filename: "preview.mp4" };
  else if (path.includes("/ai-editor/versions/")) data = version;
  else if (path === "/ai-editor/assets")
    data = {
      items: [
        {
          _id: "asset-1",
          assetId: "asset-1",
          name: "Opening brand mark.png",
          kind: "image",
          mimeType: "image/png",
        },
      ],
    };
  else if (path === "/studio/projects")
    data = [{ id: "fixture-assets", name: "Creator assets" }];
  else if (path === "/admin/dashboard")
    data = {
      range: "30d",
      users: {
        total: scenario === "long" ? 123456789 : 3200,
        active: 2400,
        newThisWeek: 40,
        paidCount: 700,
      },
      jobs: { total: 14250, successRate: 98.2 },
      clips: { total: 48200, generatedToday: 128, generatedInPeriod: 2100 },
      billing: {
        activeSubscriptions: 700,
        mrr: 1990000,
        freeUsers: 2500,
        proUsers: 650,
        businessUsers: 50,
      },
      comparisons: {
        newUsersInPeriod: 120,
        jobsInPeriod: 980,
        userGrowthRate: 15,
        jobGrowthRate: -2,
        clipGrowthRate: 24,
      },
      userGrowthSeries: days.map((d) => ({
        date: d.date,
        newUsers: d.newUsers,
      })),
      jobActivitySeries: days,
      clipActivitySeries: days.map((d) => ({
        date: d.date,
        generated: d.generated,
      })),
      jobStatusDistribution: [
        { status: "completed", label: "Completed", count: 13900 },
        { status: "failed", label: "Failed", count: 350 },
      ],
      queueHealth: queues,
      recentAudit: audit,
    };
  else if (path === "/admin/jobs/queues") data = queues;
  else if (path === "/admin/jobs/stats")
    data = {
      totalJobs: 10,
      last24Hours: { total: 5, byStatus: { completed: 4, failed: 1 } },
      last7Days: { total: 10, byStatus: { completed: 9 } },
      allTimeByStatus: { completed: 9, failed: 1 },
    };
  else if (path === `/admin/jobs/${ids.job}`)
    data = { ...job, clips: [{ ...clip, outputUrl: video }] };
  else if (path === "/admin/jobs")
    data = paginated([{ ...job, clips: [{ ...clip, outputUrl: video }] }]);
  else if (path === `/admin/users/${ids.user}`)
    data = {
      user,
      customer: null,
      recentJobs: [job],
      stats: {
        totalJobs: 12,
        completedJobs: 11,
        failedJobs: 1,
        totalEvents: 20,
      },
      recentActivities: audit,
    };
  else if (path === "/admin/users") data = paginated([user]);
  else if (path === "/admin/billing/customers")
    data = paginated([
      {
        _id: "customer-1",
        userId: user,
        userEmail: user.email,
        plan: "pro",
        creditsBalance: 1000,
        paddleSubscriptionStatus: "active",
        createdAt: date,
      },
    ]);
  else if (path === "/admin/audit") data = paginated(audit);
  else if (path.includes("/analytics"))
    data = { points: days.map((d) => ({ date: d.date, value: d.total })) };
  else if (path === "/admin/ai/providers") data = listed([provider]);
  else if (path.endsWith("/credentials"))
    data = {
      items: [
        {
          _id: ids.credential,
          label: "Primary editing credential",
          enabled: true,
          lastValidationStatus: "passed",
          lastValidatedAt: date,
        },
      ],
    };
  else if (path === "/admin/ai/models") data = listed([model]);
  else if (path === "/admin/ai/usage")
    data = {
      ...listed([
        {
          _id: "usage-1",
          modelId: model.modelId,
          status: "success",
          inputTokens: 1200,
          outputTokens: 400,
          latencyMs: 900,
          estimatedCostUsd: 0.001,
          createdAt: date,
        },
      ]),
      summary: [
        {
          _id: model.modelId,
          requests: 25,
          successes: 24,
          failures: 1,
          inputTokens: 30000,
          outputTokens: 10000,
          averageLatencyMs: 950,
          estimatedCostUsd: 0.025,
          pricedRequests: 25,
        },
      ],
    };
  else if (path.endsWith("/test") || path.endsWith("/validate"))
    data = { valid: true };
  else if (path === "/users/me/referral-stats")
    data = {
      referralCode: "AUDIT",
      successfulReferralCount: 0,
      maxReferrals: 10,
      totalCreditsEarned: 0,
    };
  else if (path.includes("/publications"))
    data = {
      publications: [],
      items: [],
      data: [],
      totalPages: 1,
      total: 0,
      meta: { total: 0, totalPages: 1 },
    };
  else if (
    path.includes("/youtube/accounts") ||
    path.includes("/youtube/channels")
  )
    data = [];
  else
    data = { items: [], data: [], rows: [], meta: { total: 0, totalPages: 1 } };
  return { status: 200, data: { success: true, data } };
}
module.exports = { fixture, ids, user };

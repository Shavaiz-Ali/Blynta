"use client";
import { APP_ROUTES } from "@blynta/types/contracts";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  History,
  Library,
  ListChecks,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { AppButton as Button, AppQueryState, AppSpinner } from "@blynta/ui";
import { StudioConversation } from "./StudioConversation";
import { StudioRenderStatus } from "./StudioRenderStatus";
import { PageContent } from "@/components/layout/PageContent";
import { useJob, useClipSignedUrl, JobStatus } from "@/features/jobs";
import { useAvailableEditingModels } from "./models";
import { ModelSelector, modelSelectionError } from "./ModelSelector";
import { StudioVideoPlayer } from "@blynta/ui/player";
import { StudioPreviewPanel } from "./StudioPreviewPanel";
import { StudioLibraryPanel } from "./StudioLibraryPanel";
import { StudioPromptComposer } from "./StudioPromptComposer";
import { useStudioAttachments } from "./attachments";
import type { PromptSubmission } from "./contracts";
import {
  downloadEditingVersion,
  studioError,
  useEditingAssets,
  useEditingPlan,
  useEditingSession,
  useEditingState,
  useEditingVersion,
  useEditingVersions,
  useInitializePlan,
  useProposal,
  useProposalAction,
  useProposeEdit,
  useRenderAction,
} from "./queries";
export function StudioWorkspace({
  jobId,
  clipId,
}: {
  jobId: string;
  clipId: string;
}) {
  const validRoute =
    /^[a-f\d]{24}$/i.test(jobId) && /^[a-f\d]{24}$/i.test(clipId);
  const job = useJob(validRoute ? jobId : "");
  const clip = job.data?.clips.find((c) => String(c._id || c.id) === clipId);
  const initialize = useInitializePlan();
  const initialized = useRef(false);
  const ready =
    clip?.status === JobStatus.COMPLETED && !job.data?.deletionRequested;
  useEffect(() => {
    if (ready && !initialized.current) {
      initialized.current = true;
      initialize.mutate({ jobId, clipId });
    }
  }, [ready, jobId, clipId, initialize]);
  const planId = initialize.data?._id ?? "";
  const plan = useEditingPlan(planId);
  const state = useEditingState(clipId, planId);
  const [sessionOverride, setSessionOverride] = useState("");
  const sessionId = sessionOverride || state.data?.session?._id || "";
  const history = useEditingSession(clipId, sessionId);
  const propose = useProposeEdit(clipId, planId);
  const [proposalId, setProposalId] = useState("");
  const currentProposal = useProposal(clipId, proposalId);
  const apply = useProposalAction(clipId, planId, "apply");
  const reject = useProposalAction(clipId, planId, "reject");
  const cancelGeneration = useProposalAction(clipId, planId, "cancel");
  const [prompt, setPrompt] = useState("");
  const [modelId, setModelId] = useState("auto");
  const models = useAvailableEditingModels(
    sessionId ? "edit_refinement" : "edit_planning",
  );
  const [versionId, setVersionId] = useState("");
  const [page, setPage] = useState(1);
  const versions = useEditingVersions(planId, page);
  const recentVersions = useEditingVersions(planId, 1);
  const selectedVersionId =
    versionId || recentVersions.data?.items[0]?._id || "";
  const version = useEditingVersion(selectedVersionId);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [toolsTab, setToolsTab] = useState("history");
  const render = useRenderAction(planId, "preview");
  const cancel = useRenderAction(planId, "cancel");
  const retry = useRenderAction(planId, "retry");
  const original = useClipSignedUrl(ready ? jobId : "", ready ? clipId : "");
  const assets = useEditingAssets();
  const attachments = useStudioAttachments();
  const [mode, setMode] = useState<"original" | "preview">("original");
  const [downloading, setDownloading] = useState(false);
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const refreshedUrls = useRef(new Set<string>());
  const sendLock = useRef(false);
  const approvalLock = useRef(false);
  const renderLock = useRef(false);
  const submission = useRef<PromptSubmission | null>(null);
  const proposal = currentProposal.data ?? propose.data;
  const allProposals = [...(state.data?.proposals ?? [])];
  if (proposal) {
    const i = allProposals.findIndex((p) => p._id === proposal._id);
    if (i >= 0)
      allProposals[i] = {
        ...proposal,
        stage: allProposals[i].stage ?? proposal.stage,
      };
    else allProposals.push(proposal);
  }
  const unresolvedSubmission = propose.isError;
  const generating =
    propose.isPending || allProposals.some((p) => p.status === "generating");
  const selectionError = modelSelectionError(models.data, modelId);
  const currentRevisionRendered = recentVersions.data?.items.some(
    (v) => v.revision === plan.data?.revision && v.status === "completed",
  );
  const url = mode === "original" ? original.data : version.data?.outputUrl;
  const completedNotice = useRef("");
  useEffect(() => {
    const current = version.data;
    if (
      current?.status === "completed" &&
      current.outputUrl &&
      completedNotice.current !== current._id
    ) {
      completedNotice.current = current._id;
      setMode("preview");
      setPlaybackFailed(false);
      toast.success("Edited preview ready.");
      void plan.refetch();
      void recentVersions.refetch();
    }
  }, [version.data, plan, recentVersions]);
  const clipTitle =
    job.data?.highlights?.find(
      (h) => h.startTime === clip?.startTime && h.endTime === clip?.endTime,
    )?.clipTitle || "AI video edit";
  async function submit(reuse = false) {
    if (
      sendLock.current ||
      generating ||
      !plan.data ||
      (reuse ? !submission.current : !prompt.trim()) ||
      selectionError ||
      (!reuse && attachments.blocked)
    )
      return;
    if (!reuse)
      submission.current = {
        planId,
        prompt: prompt.trim(),
        requestId: crypto.randomUUID(),
        ...(attachments.selectedAssetIds.length
          ? { selectedAssetIds: attachments.selectedAssetIds }
          : {}),
        ...(sessionId ? { sessionId } : {}),
        ...(modelId === "auto" ? {} : { modelId }),
      };
    if (!submission.current) return;
    sendLock.current = true;
    try {
      const result = await propose.mutateAsync(submission.current);
      setSessionOverride(result.sessionId);
      setProposalId(result._id);
      setPrompt("");
      attachments.clear();
      submission.current = null;
    } catch (error) {
      toast.error(studioError(error));
    } finally {
      sendLock.current = false;
    }
  }
  async function approve(id: string, action: "apply" | "reject") {
    if (approvalLock.current) return;
    approvalLock.current = true;
    try {
      await (action === "apply" ? apply : reject).mutateAsync(id);
      toast.success(
        action === "apply"
          ? "Changes saved. Render a preview when ready."
          : "Proposal rejected.",
      );
    } catch (error) {
      toast.error(studioError(error));
    } finally {
      approvalLock.current = false;
    }
  }
  async function renderPreview() {
    if (renderLock.current || !plan.data) return;
    renderLock.current = true;
    try {
      const result = await render.mutateAsync(planId);
      setVersionId(result._id);
      setMode(result.status === "completed" ? "preview" : "original");
      setPage(1);
      setPlaybackFailed(false);
    } catch (error) {
      toast.error(studioError(error));
    } finally {
      renderLock.current = false;
    }
  }
  async function download() {
    if (!version.data || version.data.status !== "completed" || downloading)
      return;
    setDownloading(true);
    try {
      const { signedUrl } = await downloadEditingVersion(version.data._id);
      const anchor = document.createElement("a");
      anchor.href = signedUrl;
      anchor.download = `blynta-edit-r${version.data.revision}.mp4`;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (error) {
      toast.error(studioError(error));
    } finally {
      setDownloading(false);
    }
  }
  function recoverPlayback() {
    setPlaybackFailed(true);
    const identity =
      mode === "original"
        ? `original:${jobId}:${clipId}`
        : `preview:${selectedVersionId}`;
    if (!url || refreshedUrls.current.has(identity)) return;
    refreshedUrls.current.add(identity);
    void (mode === "original" ? original.refetch() : version.refetch()).then(
      (result) => {
        if (result.isSuccess) setPlaybackFailed(false);
      },
    );
  }
  if (!validRoute || (job.data && !clip))
    return (
      <PageContent>
        <EmptyWorkspace message="This clip could not be found. Open AI Studio from your clip details." />
      </PageContent>
    );
  if (job.isError)
    return (
      <PageContent>
        <AppQueryState
          className="mx-auto max-w-3xl"
          title="Your clip couldn’t be loaded"
          description="The service may be offline. Retry to load the clip and its editing workspace."
          onRetry={() => void job.refetch()}
          retrying={job.isFetching}
        />
      </PageContent>
    );
  if (job.isPending)
    return (
      <PageContent>
        <WorkspaceSkeleton />
      </PageContent>
    );
  if (!ready)
    return (
      <PageContent>
        <EmptyWorkspace message="This clip is not ready to edit. Wait for processing to finish." />
      </PageContent>
    );
  if (initialize.isError || plan.isError)
    return (
      <PageContent>
        <div className="mx-auto max-w-5xl space-y-4">
          <AppQueryState
            title="Your editing workspace couldn’t be loaded"
            description="The editing service may be offline. Your original clip is still available; editing actions will return when the workspace loads."
            onRetry={() =>
              initialize.isError
                ? initialize.mutate({ jobId, clipId })
                : void plan.refetch()
            }
            retrying={initialize.isPending || plan.isFetching}
          >
            <Button
              variant="ghost"
              nativeButton={false}
              role="link"
              render={<Link href={APP_ROUTES.clip(jobId, clipId)} />}
            >
              Open original clip
            </Button>
          </AppQueryState>
          {original.data && (
            <section
              aria-label="Original clip"
              className="flex h-[min(60dvh,520px)] items-center justify-center rounded-lg border bg-muted/40 p-4"
            >
              <StudioVideoPlayer
                key={original.data}
                src={original.data}
                onError={recoverPlayback}
                ariaLabel="Original clip"
                className="h-full w-auto max-w-full"
              />
            </section>
          )}
        </div>
      </PageContent>
    );
  return (
    <PageContent workspace>
      <div
        className="flex min-h-0 w-full flex-col motion-reduce:[&_*]:transition-none lg:h-full"
        data-studio-workspace
      >
        <header
          aria-label="Clip tools"
          className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border/50 px-4 py-2 sm:px-6"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Button
              variant="ghost"
              size="icon-sm"
              nativeButton={false}
              role="link"
              render={<Link href="/studio" />}
              aria-label="Back to AI Studio"
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold" title={clipTitle}>
                {clipTitle}
              </h1>
              <p
                aria-live="polite"
                className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"
              >
                {plan.data ? (
                  <>
                    <Check className="size-3" />{" "}
                    {apply.isPending ? "Saving…" : "Saved"}
                  </>
                ) : (
                  "Loading edit"
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {[
              ["history", "History", History],
              ["media", "Media", Library],
              ["changes", "Changes", ListChecks],
            ].map(([value, label, Icon]) => {
              const ToolIcon = Icon as typeof History;
              return (
                <Button
                  key={String(value)}
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setToolsTab(String(value));
                    setToolsOpen(true);
                  }}
                  aria-label={String(label)}
                >
                  <ToolIcon className="size-4" />
                  <span className="hidden xl:inline">{String(label)}</span>
                </Button>
              );
            })}
            {version.data?.status === "completed" && (
              <Button
                size="sm"
                disabled={downloading}
                aria-label={
                  downloading ? "Preparing download" : "Download preview"
                }
                onClick={() => void download()}
              >
                <Download className="size-4" />
                <span className="hidden sm:inline">
                  {downloading ? "Preparing…" : "Download preview"}
                </span>
              </Button>
            )}
          </div>
        </header>
        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_clamp(360px,40%,480px)]">
          <StudioPreviewPanel
            mode={mode}
            onModeChange={setMode}
            setPlaybackFailed={setPlaybackFailed}
            url={url}
            version={version.data}
            plan={plan.data}
            playbackFailed={playbackFailed}
            onPlaybackError={recoverPlayback}
            sourcePending={original.isPending}
            sourceError={original.isError}
            previewError={version.isError}
            refreshSource={original.refetch}
            refreshPreview={version.refetch}
            clipDuration={clip.endTime - clip.startTime}
            currentRevisionRendered={currentRevisionRendered}
            renderPending={render.isPending}
            renderRunning={recentVersions.data?.items.some(
              (v) => v.status === "queued" || v.status === "processing",
            )}
            applying={apply.isPending}
            onRender={() => void renderPreview()}
            renderFeedback={
              selectedVersionId &&
              (version.data?.status !== "completed" || version.isError) ? (
                <StudioRenderStatus
                  version={version.data}
                  loading={version.isPending}
                  error={
                    version.isError ? studioError(version.error) : undefined
                  }
                  busy={cancel.isPending || retry.isPending}
                  onCancel={() =>
                    void cancel
                      .mutateAsync(selectedVersionId)
                      .catch((e) => toast.error(studioError(e)))
                  }
                  onRetry={() =>
                    void retry
                      .mutateAsync(selectedVersionId)
                      .catch((e) => toast.error(studioError(e)))
                  }
                />
              ) : undefined
            }
          />
          <section
            className="flex min-h-0 min-w-0 flex-col border-t border-border/50 bg-background lg:border-l lg:border-t-0"
            aria-label="AI editing assistant"
          >
            <header className="order-1 flex shrink-0 items-center justify-between gap-2 px-5 pb-0 pt-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                Edit with Blynta
              </h2>
              <span className="hidden text-xs text-muted-foreground lg:inline">
                Review before applying
              </span>
              {allProposals.some((p) => p.status === "pending") && (
                <Button
                  className="lg:hidden"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    document
                      .getElementById("studio-conversation")
                      ?.scrollIntoView({ block: "start" })
                  }
                >
                  Review suggestion
                </Button>
              )}
            </header>
            <StudioConversation
              messages={history.data?.messages ?? []}
              proposals={allProposals}
              plan={plan.data}
              loading={state.isPending || (!!sessionId && history.isPending)}
              generating={generating}
              busy={
                apply.isPending ||
                reject.isPending ||
                generating ||
                unresolvedSubmission
              }
              onApprove={(id, action) => void approve(id, action)}
              onSuggest={setPrompt}
              onCancelGeneration={(id) => {
                if (!cancelGeneration.isPending)
                  cancelGeneration.mutate(id, {
                    onError: (error) => toast.error(studioError(error)),
                  });
              }}
            >
              {(state.isError || history.isError) && (
                <div role="alert" className="text-sm text-destructive">
                  {studioError(state.error ?? history.error)}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      void state.refetch();
                      if (sessionId) void history.refetch();
                    }}
                  >
                    Reload history
                  </Button>
                </div>
              )}
              {(apply.isError || reject.isError) && (
                <div role="alert" className="text-sm text-destructive">
                  {studioError(apply.error ?? reject.error)}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      void plan.refetch();
                      void state.refetch();
                    }}
                  >
                    Refresh editing plan
                  </Button>
                </div>
              )}
            </StudioConversation>
            <StudioPromptComposer
              prompt={prompt}
              onChange={setPrompt}
              onSubmit={() => void submit()}
              disabled={generating || unresolvedSubmission}
              busy={generating}
              sendDisabled={
                !plan.data ||
                !prompt.trim() ||
                generating ||
                !!selectionError ||
                unresolvedSubmission
              }
              attachments={attachments}
              assets={assets.data?.items ?? []}
              error={
                !models.isPending && (selectionError || models.isError) ? (
                  <div
                    role="alert"
                    className="text-xs leading-5 text-muted-foreground"
                  >
                    {models.isError ||
                    (modelId === "auto" && !models.data?.defaultModelId)
                      ? "AI editing is unavailable. Retry model settings or contact support."
                      : selectionError}
                    <Button
                      size="sm"
                      variant="link"
                      disabled={models.isFetching}
                      onClick={() => void models.refetch()}
                    >
                      Retry model settings
                    </Button>
                  </div>
                ) : undefined
              }
              modelControl={
                <ModelSelector
                  compact
                  data={models.data}
                  loading={models.isPending}
                  error={models.isError}
                  selected={modelId}
                  onChange={setModelId}
                  disabled={generating || unresolvedSubmission}
                />
              }
              retry={
                propose.isError ? (
                  <div
                    role="alert"
                    className="space-y-2 text-xs text-destructive"
                  >
                    <p>
                      {studioError(propose.error)} The original submission is
                      retained for a safe retry.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={generating}
                      onClick={() => void submit(true)}
                    >
                      Retry same submission
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        submission.current = null;
                        propose.reset();
                      }}
                    >
                      Dismiss retry
                    </Button>
                  </div>
                ) : undefined
              }
            />
          </section>
        </div>
        <StudioLibraryPanel
          versions={versions}
          assets={assets}
          page={page}
          setPage={setPage}
          versionId={selectedVersionId}
          open={toolsOpen}
          onOpenChange={setToolsOpen}
          tab={toolsTab}
          onTabChange={setToolsTab}
          proposals={allProposals}
          plan={plan.data}
          onApprove={(id, action) => void approve(id, action)}
          renderBusy={cancel.isPending || retry.isPending}
          onCancel={(id) =>
            void cancel
              .mutateAsync(id)
              .catch((e) => toast.error(studioError(e)))
          }
          onRetry={(id) =>
            void retry.mutateAsync(id).catch((e) => toast.error(studioError(e)))
          }
          onVersionSelect={(id) => {
            setVersionId(id);
            setMode("preview");
            setPlaybackFailed(false);
            setToolsOpen(false);
          }}
          onAttach={attachments.select}
          generating={generating || apply.isPending || reject.isPending}
          unresolvedSubmission={unresolvedSubmission}
        />
      </div>
    </PageContent>
  );
}

function EmptyWorkspace({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border p-8">
      <h1 className="text-xl font-semibold">AI Studio</h1>
      <p role="alert" className="mt-3 text-sm text-muted-foreground">
        {message}
      </p>
      <Link
        href="/studio"
        className="mt-5 inline-block text-sm text-primary hover:underline"
      >
        Back to AI Studio
      </Link>
    </div>
  );
}
function WorkspaceSkeleton() {
  return (
    <div
      role="status"
      className="mx-auto flex min-h-64 max-w-xl items-center justify-center gap-3 rounded-lg border bg-card p-6 text-sm text-muted-foreground"
    >
      <AppSpinner /> Loading your editing workspace…
    </div>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppButton as Button, AppQueryState, AppSpinner } from "@blynta/ui";
import { ConversationMessage } from "./StudioPanels";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardLayout } from "@/features/dashboard/components/DashboardLayout";
import { useJob, useClipSignedUrl, JobStatus } from "@/features/jobs";
import { useAvailableEditingModels } from "./models";
import { ModelSelector, modelSelectionError } from "./ModelSelector";
import { ProposalCard } from "./ProposalCard";
import { StudioVideoPlayer } from "@blynta/ui/player";
import { StudioPreviewPanel } from "./StudioPreviewPanel";
import { StudioLibraryPanel } from "./StudioLibraryPanel";
import { StudioPromptComposer } from "./StudioPromptComposer";
import { useStudioAttachments } from "./attachments";
import { renderPollInterval } from "./presentation";
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
  const [prompt, setPrompt] = useState("");
  const [modelId, setModelId] = useState("auto");
  const models = useAvailableEditingModels(
    sessionId ? "edit_refinement" : "edit_planning",
  );
  const [versionId, setVersionId] = useState("");
  const [page, setPage] = useState(1);
  const versions = useEditingVersions(planId, page);
  const version = useEditingVersion(versionId);
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
    if (i >= 0) allProposals[i] = proposal;
    else allProposals.push(proposal);
  }
  const unresolvedSubmission = propose.isError;
  const generating =
    propose.isPending || allProposals.some((p) => p.status === "generating");
  const selectionError = modelSelectionError(models.data, modelId);
  const currentRevisionRendered = versions.data?.items.some(
    (v) => v.revision === plan.data?.revision && v.status === "completed",
  );
  const url = mode === "original" ? original.data : version.data?.outputUrl;
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
      setMode("preview");
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
        : `preview:${versionId}`;
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
      <DashboardLayout>
        <EmptyWorkspace message="This clip could not be found. Open AI Studio from your clip details." />
      </DashboardLayout>
    );
  if (job.isError)
    return (
      <DashboardLayout>
        <AppQueryState
          className="mx-auto max-w-3xl"
          title="Your clip couldn’t be loaded"
          description="The service may be offline. Retry to load the clip and its editing workspace."
          onRetry={() => void job.refetch()}
          retrying={job.isFetching}
        />
      </DashboardLayout>
    );
  if (job.isPending)
    return (
      <DashboardLayout>
        <WorkspaceSkeleton />
      </DashboardLayout>
    );
  if (!ready)
    return (
      <DashboardLayout>
        <EmptyWorkspace message="This clip is not ready to edit. Wait for processing to finish." />
      </DashboardLayout>
    );
  if (initialize.isError || plan.isError)
    return (
      <DashboardLayout>
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
              render={<Link href={`/my-clips/${jobId}/clips/${clipId}`} />}
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
      </DashboardLayout>
    );
  return (
    <DashboardLayout>
      <div className="mx-auto min-w-0 w-full max-w-[1500px] space-y-4 pb-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/studio"
              aria-label="Back to AI Studio"
              className="rounded-lg border p-2 hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div className="min-w-0">
              <p className="text-xs text-primary">AI Studio</p>
              <h1 className="max-w-xl truncate text-lg font-semibold sm:text-xl">
                {clipTitle}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span aria-live="polite" className="text-xs text-muted-foreground">
              {plan.data
                ? `Revision ${plan.data.revision} · Changes saved`
                : "Loading edit plan"}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={version.data?.status !== "completed" || downloading}
              onClick={() => void download()}
            >
              <Download className="size-4" />
              {downloading ? "Preparing…" : "Download preview"}
            </Button>
          </div>
        </header>
        {allProposals.some(
          (p) => p.status === "pending" || p.status === "applying",
        ) && (
          <p
            role="status"
            className="rounded-lg bg-primary/5 px-4 py-2 text-xs text-primary"
          >
            Review your suggestion below. Applying saves changes; rendering is a
            separate step.
          </p>
        )}
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-4">
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
              applying={apply.isPending}
              onRender={() => void renderPreview()}
            />
            {versionId && (
              <section
                className="rounded-xl border bg-card p-4"
                aria-live="polite"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      {version.isPending
                        ? "Loading preview status…"
                        : version.data?.status === "completed"
                          ? "Preview ready"
                          : version.data?.status === "queued"
                            ? "Preparing preview"
                            : version.data?.status === "processing"
                              ? "Rendering video"
                              : version.data?.status === "cancelled"
                                ? "Preview cancelled"
                                : "Rendering failed"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {version.data?.error ||
                        (version.data?.status === "completed"
                          ? "Choose this version to watch or download it."
                          : "Rendering runs in the background. You can leave this page.")}
                    </p>
                  </div>
                  {renderPollInterval(version.data?.status) && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={cancel.isPending}
                      onClick={() =>
                        void cancel
                          .mutateAsync(versionId)
                          .catch((e) => toast.error(studioError(e)))
                      }
                    >
                      Cancel
                    </Button>
                  )}
                  {version.data?.status === "failed" &&
                    version.data.retryable !== false && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={retry.isPending}
                        onClick={() =>
                          void retry
                            .mutateAsync(versionId)
                            .catch((e) => toast.error(studioError(e)))
                        }
                      >
                        Retry render
                      </Button>
                    )}
                </div>
                {version.data?.status === "processing" &&
                  typeof version.data.progress === "number" && (
                    <div className="mt-3 space-y-1">
                      <progress
                        aria-label="Render progress"
                        max={100}
                        value={version.data.progress}
                        className="h-2 w-full accent-primary"
                      />
                      <p className="text-right text-xs text-muted-foreground">
                        {Math.round(version.data.progress)}%
                      </p>
                    </div>
                  )}
                {version.isError && (
                  <p role="alert" className="mt-2 text-sm text-destructive">
                    {studioError(version.error)}
                  </p>
                )}
              </section>
            )}
          </div>
          <section
            className="flex h-[min(82dvh,740px)] min-h-[520px] min-w-0 flex-col overflow-hidden rounded-lg border bg-card lg:sticky lg:top-4"
            aria-label="AI editing assistant"
          >
            <header className="space-y-3 border-b p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="size-4 text-primary" /> AI Assistant
              </h2>
              <ModelSelector
                data={models.data}
                loading={models.isPending}
                error={models.isError}
                selected={modelId}
                onChange={setModelId}
                disabled={generating || unresolvedSubmission}
              />
            </header>
            <div
              className="themed-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-4"
              aria-live="polite"
              aria-busy={generating}
            >
              {state.isPending || (sessionId && history.isPending) ? (
                <>
                  <Skeleton className="ml-8 h-16 rounded-xl" />
                  <Skeleton className="mr-8 h-20 rounded-xl" />
                </>
              ) : (
                <>
                  {!history.data?.messages.length && (
                    <div className="space-y-3 py-4">
                      <h3 className="text-sm font-medium">
                        What would you like to change?
                      </h3>
                      <p className="text-sm leading-6 text-muted-foreground">
                        Describe an effect, mention a moment, or adjust the
                        sound. Attach your own PNG image or audio to use in an
                        edit.
                      </p>
                    </div>
                  )}
                  {history.data?.messages.map((m) => (
                    <ConversationMessage
                      key={m._id}
                      role={m.role}
                      content={m.content}
                    />
                  ))}
                </>
              )}
              {(state.isError || history.isError) && (
                <p role="alert" className="text-sm text-destructive">
                  {studioError(state.error ?? history.error)}{" "}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="underline"
                    onClick={() => {
                      void state.refetch();
                      if (sessionId) void history.refetch();
                    }}
                  >
                    Reload history
                  </Button>
                </p>
              )}
              {allProposals.map((p) => (
                <ProposalCard
                  key={p._id}
                  proposal={p}
                  plan={plan.data}
                  busy={apply.isPending || reject.isPending || generating}
                  onApply={() => void approve(p._id, "apply")}
                  onReject={() => void approve(p._id, "reject")}
                />
              ))}
              {generating && (
                <div role="status" className="space-y-2 rounded-xl border p-4">
                  <p className="text-sm text-muted-foreground">
                    Preparing your suggestion…
                  </p>
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              )}
              {(apply.isError || reject.isError) && (
                <p role="alert" className="text-sm text-destructive">
                  {studioError(apply.error ?? reject.error)}{" "}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="underline"
                    onClick={() => {
                      void plan.refetch();
                      void state.refetch();
                    }}
                  >
                    Refresh editing plan
                  </Button>
                </p>
              )}
            </div>
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
          versionId={versionId}
          onVersionSelect={(id) => {
            setVersionId(id);
            setMode("preview");
            setPlaybackFailed(false);
          }}
          onAttach={attachments.select}
          generating={generating}
          unresolvedSubmission={unresolvedSubmission}
        />
      </div>
    </DashboardLayout>
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

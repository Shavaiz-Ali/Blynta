"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  RefreshCw,
  Send,
  Sparkles,
  Video,
  Paperclip,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardLayout } from "@/features/dashboard/components/DashboardLayout";
import { useJob, useClipSignedUrl, JobStatus } from "@/features/jobs";
import { useAvailableEditingModels } from "./models";
import { ModelSelector, modelSelectionError } from "./ModelSelector";
import { ProposalCard } from "./ProposalCard";
import { AssetUpload } from "./AssetUpload";
import { editTime, renderPollInterval } from "./presentation";
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
      selectionError
    )
      return;
    if (!reuse)
      submission.current = {
        planId,
        prompt: prompt.trim(),
        requestId: crypto.randomUUID(),
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
        <EmptyWorkspace message={studioError(job.error)} />
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
  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-[1500px] space-y-4 pb-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href={`/my-clips/${jobId}/clips/${clipId}`}
              aria-label="Back to clip"
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
        {(initialize.isError || plan.isError) && (
          <div
            role="alert"
            className="rounded-xl border border-destructive/30 p-4 text-sm"
          >
            <p>{studioError(initialize.error ?? plan.error)}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() =>
                initialize.isError
                  ? initialize.mutate({ jobId, clipId })
                  : void plan.refetch()
              }
            >
              Retry loading plan
            </Button>
          </div>
        )}
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,1fr)]">
          <div className="min-w-0 space-y-4">
            <section
              className="overflow-hidden rounded-2xl border bg-card"
              aria-label="Video preview"
            >
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="flex gap-1 rounded-lg bg-muted p-1">
                  <button
                    aria-pressed={mode === "original"}
                    onClick={() => {
                      setMode("original");
                      setPlaybackFailed(false);
                    }}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium focus-visible:ring-2 focus-visible:ring-primary ${mode === "original" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                  >
                    Original
                  </button>
                  <button
                    aria-pressed={mode === "preview"}
                    onClick={() => {
                      setMode("preview");
                      setPlaybackFailed(false);
                    }}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium focus-visible:ring-2 focus-visible:ring-primary ${mode === "preview" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                  >
                    Edited preview
                  </button>
                </div>
                <span className="text-xs text-muted-foreground">
                  {mode === "preview" && version.data
                    ? `Rendered revision ${version.data.revision}`
                    : "Source clip"}
                </span>
              </div>
              <div className="flex min-h-72 items-center justify-center bg-zinc-950 p-4 sm:min-h-[440px]">
                {url && !playbackFailed ? (
                  <video
                    key={url}
                    src={url}
                    controls
                    playsInline
                    preload="metadata"
                    aria-label={
                      mode === "original"
                        ? "Original clip"
                        : `Edited preview revision ${version.data?.revision}`
                    }
                    className="max-h-[520px] w-full rounded-lg object-contain"
                    onError={recoverPlayback}
                  />
                ) : mode === "original" && original.isPending ? (
                  <Skeleton className="h-72 w-full bg-white/10" />
                ) : (
                  <div className="max-w-sm space-y-3 text-center text-sm text-zinc-300">
                    <Video className="mx-auto size-8 text-zinc-500" />
                    <p>
                      {playbackFailed
                        ? "Playback failed. Refresh the authorized media link and try again."
                        : mode === "preview" && version.data
                          ? version.data.status === "completed"
                            ? "Loading preview media…"
                            : version.data.status === "failed"
                              ? "Rendering failed."
                              : version.data.status === "cancelled"
                                ? "Preview cancelled."
                                : "Your preview is rendering."
                          : mode === "original"
                            ? "Source playback is unavailable."
                            : "Apply an edit, then render a preview to see the result."}
                    </p>
                    {(playbackFailed ||
                      original.isError ||
                      version.isError) && (
                      <button
                        className="underline focus-visible:ring-2"
                        onClick={() => {
                          setPlaybackFailed(false);
                          void (mode === "original"
                            ? original.refetch()
                            : version.refetch());
                        }}
                      >
                        Refresh playback link
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  {editTime(clip.endTime - clip.startTime)} original ·{" "}
                  {plan.data
                    ? `${editTime(plan.data.outputDuration)} edited`
                    : "Loading plan"}
                  {plan.data && !currentRevisionRendered
                    ? " · Preview needed"
                    : ""}
                </p>
                <Button
                  size="sm"
                  disabled={!plan.data || render.isPending || apply.isPending}
                  onClick={() => void renderPreview()}
                >
                  <Video className="size-4" />
                  {render.isPending ? "Preparing preview…" : "Render preview"}
                </Button>
              </div>
            </section>
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
            <details className="rounded-xl border bg-card p-4" open>
              <summary className="cursor-pointer text-sm font-semibold focus-visible:ring-2 focus-visible:ring-primary">
                Version history
              </summary>
              <p className="mt-2 text-xs text-muted-foreground">
                Preview history is read-only. Selecting an older version does
                not change your edit plan.
              </p>
              <div className="mt-3 space-y-2">
                {versions.isPending ? (
                  <>
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </>
                ) : versions.isError ? (
                  <p role="alert" className="text-sm text-destructive">
                    {studioError(versions.error)}
                  </p>
                ) : !versions.data?.items.length ? (
                  <p className="py-4 text-sm text-muted-foreground">
                    Your rendered previews will appear here.
                  </p>
                ) : (
                  versions.data.items.map((v) => (
                    <button
                      key={v._id}
                      onClick={() => {
                        setVersionId(v._id);
                        setMode("preview");
                        setPlaybackFailed(false);
                      }}
                      aria-pressed={versionId === v._id}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left text-xs focus-visible:ring-2 focus-visible:ring-primary ${versionId === v._id ? "border-primary bg-primary/5" : "hover:bg-muted"}`}
                    >
                      <div>
                        <p className="font-medium">Revision {v.revision}</p>
                        <p className="mt-1 text-muted-foreground">
                          {new Date(v.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <span className="capitalize text-muted-foreground">
                        {v.status}
                      </span>
                    </button>
                  ))
                )}
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={(versions.data?.items.length ?? 0) < 25}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </details>
          </div>
          <section
            className="flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card"
            aria-label="AI editing assistant"
          >
            <header className="space-y-3 border-b p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="size-4 text-primary" /> Editing assistant
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
              className="max-h-[640px] min-h-48 space-y-4 overflow-y-auto p-4"
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
                        Ask for zooms, text, or audio adjustments. Image and
                        music edits use your uploaded assets. Caption
                        restructuring and automatic scene cuts are not available
                        here.
                      </p>
                    </div>
                  )}
                  {history.data?.messages.map((m) => (
                    <div
                      key={m._id}
                      className={`rounded-xl px-4 py-3 text-sm leading-6 ${m.role === "user" ? "ml-6 bg-primary/10" : "mr-6 bg-muted/60"}`}
                    >
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {m.role === "user" ? "You" : "Blynta"}
                      </p>
                      <p className="whitespace-pre-wrap break-words">
                        {m.content}
                      </p>
                    </div>
                  ))}
                </>
              )}
              {(state.isError || history.isError) && (
                <p role="alert" className="text-sm text-destructive">
                  {studioError(state.error ?? history.error)}{" "}
                  <button
                    className="underline"
                    onClick={() => {
                      void state.refetch();
                      if (sessionId) void history.refetch();
                    }}
                  >
                    Reload history
                  </button>
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
                  <button
                    className="underline"
                    onClick={() => {
                      void plan.refetch();
                      void state.refetch();
                    }}
                  >
                    Refresh editing plan
                  </button>
                </p>
              )}
            </div>
            <form
              className="space-y-3 border-t bg-background/50 p-4"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <div className="flex flex-wrap gap-2">
                {[
                  "Lower the original audio to 70%.",
                  `Add a smooth zoom from 00:00 to ${editTime(Math.min(plan.data?.outputDuration ?? 3, 3))}.`,
                ].map((suggestion) => (
                  <button
                    type="button"
                    key={suggestion}
                    disabled={generating || unresolvedSubmission}
                    onClick={() => setPrompt(suggestion)}
                    className="rounded-full border px-3 py-1.5 text-[11px] text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
              <label htmlFor="studio-prompt" className="sr-only">
                Describe your editing instructions
              </label>
              <textarea
                id="studio-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                maxLength={4000}
                rows={3}
                disabled={generating || unresolvedSubmission}
                placeholder="Describe an edit, or mention a phrase from the clip…"
                className="w-full resize-y rounded-xl border bg-background p-3 text-sm leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
              />
              {propose.isError && (
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
              )}
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] text-muted-foreground">
                  Suggestions are saved for review. No automatic renders.
                </p>
                <Button
                  type="submit"
                  size="sm"
                  disabled={
                    !plan.data ||
                    !prompt.trim() ||
                    generating ||
                    !!selectionError ||
                    unresolvedSubmission
                  }
                >
                  <Send className="size-3.5" />
                  {generating ? "Working…" : "Send"}
                </Button>
              </div>
              <details className="border-t pt-3">
                <summary className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary">
                  <Paperclip className="size-3.5" /> Your editing assets
                </summary>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Use an uploaded audio or PNG asset in your next instruction.
                  This editor has no stock asset library.
                </p>
                {assets.isPending ? (
                  <Skeleton className="mt-3 h-10 w-full" />
                ) : assets.isError ? (
                  <p role="alert" className="mt-2 text-xs text-destructive">
                    {studioError(assets.error)}
                  </p>
                ) : !assets.data?.items.length ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    No compatible uploaded assets yet. Upload audio or PNG
                    images through your existing Studio asset manager, then
                    refresh this list.
                  </p>
                ) : (
                  <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                    {assets.data.items.map((asset) => (
                      <li key={asset._id}>
                        <button
                          type="button"
                          disabled={generating || unresolvedSubmission}
                          onClick={() =>
                            setPrompt(
                              (p) =>
                                `${p}${p ? "\n" : ""}Use my uploaded ${asset.kind} asset “${asset.name}”.`,
                            )
                          }
                          className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-xs hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <span className="truncate">{asset.name}</span>
                          <span className="ml-3 text-muted-foreground">
                            {asset.kind}
                            {asset.duration
                              ? ` · ${editTime(asset.duration)}`
                              : ""}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  onClick={() => void assets.refetch()}
                >
                  <RefreshCw className="size-3" /> Refresh assets
                </button>
                <AssetUpload />
              </details>
            </form>
          </section>
        </div>
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
    <div aria-label="Loading editing workspace" className="space-y-4">
      <Skeleton className="h-10 w-1/2" />
      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Skeleton className="h-[440px] rounded-2xl" />
        <div className="space-y-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

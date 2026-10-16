"use client";
import scrollbars from "./studio-scrollbars.module.css";
import { useRef } from "react";
import { attachmentAccept, type useStudioAttachments } from "./attachments";
import { ProposalCard } from "./ProposalCard";
import { AppButton as Button, AppDialog, AppFileInput } from "@blynta/ui";
import { RefreshCw } from "lucide-react";
import type { EditingPlan, Proposal, StudioAsset } from "./contracts";
import { studioError, useEditingVersions, useEditingAssets } from "./queries";
import { describeChange, editTime } from "./presentation";
export function StudioToolDialog({
  attachments,
  onApprove,
  versions,
  assets,
  page,
  setPage,
  versionId,
  onVersionSelect,
  onAttach,
  generating,
  unresolvedSubmission,
  open,
  onOpenChange,
  tab,
  proposals,
  plan,
  onCancel,
  onRetry,
  renderBusy,
}: {
  attachments: ReturnType<typeof useStudioAttachments>;
  onApprove: (id: string, action: "apply" | "reject") => void;
  versions: ReturnType<typeof useEditingVersions>;
  assets: ReturnType<typeof useEditingAssets>;
  page: number;
  setPage: (fn: (p: number) => number) => void;
  versionId: string;
  onVersionSelect: (id: string) => void;
  onAttach: (asset: StudioAsset) => void;
  generating: boolean;
  unresolvedSubmission: boolean;
  open: boolean;
  onOpenChange: (value: boolean) => void;
  tab: string;
  proposals: Proposal[];
  plan?: EditingPlan;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  renderBusy: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const workspaceAssets = assets.data?.items ?? [];
  const pending = proposals.filter(
    (p) => p.status === "pending" || p.status === "applying",
  );
  const original = plan?.plan.audio.original;
  const hasSavedChanges =
    !!plan &&
    (plan.revision > 1 ||
      plan.plan.operations.length > 0 ||
      plan.plan.audio.tracks.length > 0 ||
      (!!original &&
        (!original.enabled ||
          original.gain !== 1 ||
          original.mutes.length > 0 ||
          original.automation.length > 0)));
  const uploadButton = (
    <Button
      type="button"
      disabled={generating || unresolvedSubmission}
      onClick={() => fileRef.current?.click()}
    >
      Upload Media
    </Button>
  );
  const history = (
    <div className="min-w-0">
      {!!versions.data?.items.length && (
        <p className="text-xs text-muted-foreground">
          Select a render to preview it. Your saved edit stays current.
        </p>
      )}
      <div className="mt-3 space-y-2">
        {versions.isPending ? (
          <p role="status" className="py-4 text-sm text-muted-foreground">
            Loading history…
          </p>
        ) : versions.isError && !versions.data ? (
          <div>
            <p role="alert" className="text-sm text-destructive">
              {studioError(versions.error)}
            </p>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void versions.refetch()}
            >
              Retry history
            </Button>
          </div>
        ) : !versions.data?.items.length ? (
          <DialogEmpty
            title="No edit history yet"
            description="Your rendered previews will appear here."
          />
        ) : (
          versions.data.items.map((v) => (
            <div key={v._id} className="space-y-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                key={v._id}
                onClick={() => {
                  onVersionSelect(v._id);
                }}
                aria-pressed={versionId === v._id}
                contentClassName="w-full items-center justify-between whitespace-normal"
                className={`flex h-auto w-full items-center justify-between gap-3 rounded-lg p-3 text-left text-xs focus-visible:ring-2 focus-visible:ring-primary ${versionId === v._id ? "bg-primary/5 ring-1 ring-primary/20" : "hover:bg-muted"}`}
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
              </Button>
              {(v.status === "queued" || v.status === "processing") && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={renderBusy}
                  onClick={() => onCancel(v._id)}
                >
                  Cancel render
                </Button>
              )}
              {v.status === "failed" && v.retryable !== false && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={renderBusy}
                  onClick={() => onRetry(v._id)}
                >
                  Retry render
                </Button>
              )}
            </div>
          ))
        )}
      </div>
      {versions.data && (page > 1 || versions.data.items.length >= 25) && (
        <div className="mt-3 flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={versions.isFetching || page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={
              versions.isFetching || (versions.data?.items.length ?? 0) < 25
            }
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
  const media = (
    <div className="min-w-0 space-y-4">
      <AppFileInput
        ref={fileRef}
        label="Upload media to AI Studio"
        accept={attachmentAccept}
        disabled={generating || unresolvedSubmission}
        onFile={(file) => {
          if (file) attachments.addFiles([file]);
        }}
      />
      {!!workspaceAssets.length && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Choose media to attach to your next edit.
          </p>
          {uploadButton}
        </div>
      )}
      {assets.isPending && !assets.data ? (
        <p role="status" className="py-4 text-sm text-muted-foreground">
          Loading media…
        </p>
      ) : assets.isError && !assets.data ? (
        <p role="alert" className="text-sm text-destructive">
          {studioError(assets.error)}
        </p>
      ) : !workspaceAssets.length ? (
        <DialogEmpty
          title="No media yet"
          description="Upload assets to use in your AI edits."
        >
          {uploadButton}
        </DialogEmpty>
      ) : (
        <ul
          aria-label="Ready editing media"
          className={
            scrollbars.slim + " max-h-[45dvh] space-y-2 overflow-y-auto"
          }
        >
          {workspaceAssets.map((asset) => {
            const attached = attachments.items.find(
              (a) => a.assetId === asset.assetId,
            );
            return (
              <li
                key={asset.assetId}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p
                    className="truncate text-sm font-medium"
                    title={asset.name}
                  >
                    {asset.name}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {asset.kind === "image" ? "Image" : "Audio"}
                    {asset.duration ? " · " + editTime(asset.duration) : ""}
                    {asset.sourceGroup ? " · " + asset.sourceGroup : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={attached ? "ghost" : "outline"}
                  className="shrink-0"
                  disabled={generating || unresolvedSubmission}
                  onClick={() => {
                    if (attached) attachments.remove(attached.key);
                    else onAttach(asset);
                  }}
                >
                  {attached ? "Remove from prompt" : "Use in edit"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {!!attachments.items.filter((a) => a.file || a.status !== "ready")
        .length && (
        <ul aria-label="Media uploads" className="space-y-2">
          {attachments.items
            .filter((a) => a.file || a.status !== "ready")
            .map((a) => (
              <li key={a.key} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{a.name}</span>
                  <span
                    role="status"
                    className="shrink-0 text-xs text-muted-foreground"
                  >
                    {a.status === "processing"
                      ? "Validating…"
                      : a.status === "uploading"
                        ? "Uploading…"
                        : a.status}
                  </span>
                </div>
                {a.error && (
                  <p role="alert" className="mt-2 text-xs text-destructive">
                    {a.error}
                  </p>
                )}
                {a.status === "failed" && (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    disabled={generating || unresolvedSubmission}
                    onClick={() => attachments.retry(a.key)}
                  >
                    Retry upload
                  </Button>
                )}
              </li>
            ))}
        </ul>
      )}
      {(attachments.error || attachments.validationError) && (
        <p role="alert" className="text-sm text-destructive">
          {attachments.error || attachments.validationError}
          {attachments.validationError && (
            <Button variant="link" size="sm" onClick={attachments.recheck}>
              Check validation again
            </Button>
          )}
        </p>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={assets.isFetching}
        onClick={() => void assets.refetch()}
      >
        <RefreshCw className="size-3" /> Refresh assets
      </Button>
    </div>
  );
  const changes = (
    <div className="space-y-4">
      {!!pending.length && (
        <div className="space-y-3">
          {pending.map((p) => (
            <ProposalCard
              key={p._id}
              proposal={p}
              plan={plan}
              assets={assets.data?.items}
              busy={generating || unresolvedSubmission}
              onApply={() => onApprove(p._id, "apply")}
              onReject={() => onApprove(p._id, "reject")}
            />
          ))}
        </div>
      )}
      {plan && hasSavedChanges ? (
        <>
          <h3 className="text-sm font-medium">Saved edits</h3>
          <p className="text-xs text-muted-foreground">
            Original audio ·{" "}
            {plan.plan.audio.original.enabled
              ? `${Math.round(plan.plan.audio.original.gain * 100)}% volume`
              : "Muted"}
          </p>
          {plan.plan.operations.map((op) => {
            const text = describeChange({
              action: "add",
              operation: op,
            });
            return (
              <div key={op.id} className="space-y-1">
                <p className="text-sm font-medium">
                  {text.title.replace(/^Add /, "")} ·{" "}
                  {op.enabled ? "Enabled" : "Disabled"}
                </p>
                <p className="text-xs text-muted-foreground">{text.detail}</p>
              </div>
            );
          })}
          {plan.plan.audio.tracks.map((t) => (
            <p key={t.id} className="text-sm">
              {t.role.replaceAll("_", " ")} ·{" "}
              {t.enabled ? `${Math.round(t.gain * 100)}% volume` : "Disabled"}
            </p>
          ))}
          {!plan.plan.operations.length && !plan.plan.audio.tracks.length && (
            <p className="text-xs text-muted-foreground">
              No visual effects or additional audio tracks.
            </p>
          )}
        </>
      ) : (
        !pending.length && (
          <DialogEmpty
            title="No pending changes"
            description="Ask Blynta to edit your video to get started."
          />
        )
      )}
    </div>
  );
  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      contentClassName={
        tab === "media"
          ? "sm:max-w-2xl max-h-[85dvh]"
          : "sm:max-w-lg max-h-[85dvh]"
      }
      title={
        tab === "history" ? "History" : tab === "media" ? "Media" : "Changes"
      }
    >
      {tab === "history" ? history : tab === "media" ? media : changes}
    </AppDialog>
  );
}

function DialogEmpty({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center gap-2 py-8 text-center">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="max-w-xs text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

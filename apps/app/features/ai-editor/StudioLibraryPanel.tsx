"use client";
import { useSyncExternalStore } from "react";
import scrollbars from "./studio-scrollbars.module.css";
import {
  AppButton as Button,
  AppSheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  AppTabs,
} from "@blynta/ui";
import { RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { EditingPlan, Proposal } from "./contracts";
import { studioError, useEditingVersions, useEditingAssets } from "./queries";
import { describeChange, editTime } from "./presentation";
import type { StudioAsset } from "./contracts";
const desktopQuery = "(min-width: 1024px)";
const subscribeDesktop = (onChange: () => void) => {
  const query = window.matchMedia(desktopQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const desktopSnapshot = () => window.matchMedia(desktopQuery).matches;
const serverSnapshot = () => false;
export function StudioLibraryPanel({
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
  onTabChange,
  proposals,
  plan,
  onCancel,
  onRetry,
  renderBusy,
  attachedAssetIds = [],
}: {
  versions: ReturnType<typeof useEditingVersions>;
  assets: ReturnType<typeof useEditingAssets>;
  page: number;
  setPage: (fn: (p: number) => number) => void;
  versionId: string;
  onVersionSelect: (id: string) => void;
  onAttach: (a: StudioAsset) => void;
  generating: boolean;
  unresolvedSubmission: boolean;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tab: string;
  onTabChange: (v: string) => void;
  proposals: Proposal[];
  plan?: EditingPlan;
  onApprove: (id: string, action: "apply" | "reject") => void;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  renderBusy: boolean;
  attachedAssetIds?: string[];
}) {
  const desktop = useSyncExternalStore(
    subscribeDesktop,
    desktopSnapshot,
    serverSnapshot,
  );
  const usedAssets = new Set([
    ...attachedAssetIds,
    ...(plan?.plan.audio.tracks.map((t) => t.assetId) ?? []),
    ...(plan?.plan.operations.flatMap((op) =>
      typeof op.params.assetId === "string" ? [op.params.assetId] : [],
    ) ?? []),
    ...proposals.flatMap(
      (p) =>
        p.patch?.changes.flatMap((c) =>
          "operation" in c && typeof c.operation.params.assetId === "string"
            ? [c.operation.params.assetId]
            : "track" in c
              ? [c.track.assetId]
              : [],
        ) ?? [],
    ),
  ]);
  const workspaceAssets =
    assets.data?.items.filter((a) => usedAssets.has(a.assetId)) ?? [];
  const history = (
    <div className="min-w-0">
      <p className="mt-2 text-xs text-muted-foreground">
        Select a render to preview it. Your saved edit stays current.
      </p>
      <div className="mt-3 space-y-2">
        {versions.isPending ? (
          <>
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </>
        ) : versions.isError ? (
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
          <p className="py-4 text-sm text-muted-foreground">
            Your rendered previews will appear here.
          </p>
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
    </div>
  );
  const media = (
    <div className="min-w-0">
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        Media used in this clip’s edits and conversation. Choose other library
        media from Attach in the composer.
      </p>
      {assets.isPending ? (
        <Skeleton className="mt-3 h-10 w-full" />
      ) : assets.isError ? (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {studioError(assets.error)}
        </p>
      ) : !workspaceAssets.length ? (
        <p className="mt-3 text-xs text-muted-foreground">
          No ready media yet. Use Attach in the composer to upload a PNG image
          or audio file.
        </p>
      ) : (
        <ul
          className={`${scrollbars.slim} mt-2 max-h-40 space-y-1 overflow-y-auto`}
        >
          {workspaceAssets.map((asset) => (
            <li key={asset._id}>
              <Button
                type="button"
                variant="ghost"
                size="sm"

                disabled={generating || unresolvedSubmission}
                onClick={() => {
                  onAttach(asset);
                  onOpenChange(false);
                }}
                className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-xs hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="truncate">{asset.name}</span>
                <span className="ml-3 text-muted-foreground">
                  Ready · {asset.kind}
                  {asset.duration ? ` · ${editTime(asset.duration)}` : ""}
                </span>
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"

        className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
        onClick={() => void assets.refetch()}
      >
        <RefreshCw className="size-3" /> Refresh assets
      </Button>
    </div>
  );
  return (
    <AppSheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={desktop ? "right" : "bottom"}
        className="max-h-[85dvh] rounded-t-2xl motion-reduce:transition-none motion-reduce:[&_*]:transition-none lg:h-full lg:max-h-dvh lg:rounded-none"
      >
        <SheetHeader>
          <SheetTitle>Editing tools</SheetTitle>
          <SheetDescription>
            Preview versions, ready media and reviewed suggestions.
          </SheetDescription>
        </SheetHeader>
        <AppTabs
          value={tab}
          onValueChange={onTabChange}
          size="sm"
          variant="default"
          className="min-h-0 flex-1 gap-0 px-4 pb-5"
          listClassName="w-full shrink-0 justify-start"
          contentClassName={`${scrollbars.slim} min-h-0 overflow-y-auto py-4`}
          tabs={[
            { value: "history", label: "History", content: history },
            { value: "media", label: "Media", content: media },
            {
              value: "changes",
              label: "Changes",
              content: (
                <div className="space-y-4">
                  {plan ? (
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
                            <p className="text-xs text-muted-foreground">
                              {text.detail}
                            </p>
                          </div>
                        );
                      })}
                      {plan.plan.audio.tracks.map((t) => (
                        <p key={t.id} className="text-sm">
                          {t.role.replaceAll("_", " ")} ·{" "}
                          {t.enabled
                            ? `${Math.round(t.gain * 100)}% volume`
                            : "Disabled"}
                        </p>
                      ))}
                      {!plan.plan.operations.length &&
                        !plan.plan.audio.tracks.length && (
                          <p className="text-xs text-muted-foreground">
                            No visual effects or additional audio tracks.
                          </p>
                        )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Saved editing operations will appear here.
                    </p>
                  )}
                </div>
              ),
            },
          ]}
        />
      </SheetContent>
    </AppSheet>
  );
}

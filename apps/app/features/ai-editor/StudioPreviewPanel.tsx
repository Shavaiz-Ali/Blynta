"use client";
import {
  AppTabs,
  AppTabsList,
  AppTabsTrigger,
  AppTabsContent,
  AppButton as Button,
  AppSpinner,
} from "@blynta/ui";
import { StudioVideoPlayer } from "@blynta/ui/player";
import { Video } from "lucide-react";
import { editTime, renderPollInterval } from "./presentation";
import type { EditingPlan, EditingVersion } from "./contracts";
import rendering from "./rendering.module.css";
export function StudioPreviewPanel({
  mode,
  onModeChange,
  setPlaybackFailed,
  url,
  version,
  plan,
  playbackFailed,
  onPlaybackError,
  sourcePending,
  sourceError,
  previewError,
  refreshSource,
  refreshPreview,
  clipDuration,
  currentRevisionRendered,
  renderPending,
  renderRunning,
  applying,
  onRender,
  renderFeedback,
  tools,
  downloadControl,
}: {
  mode: "original" | "preview";
  onModeChange: (v: "original" | "preview") => void;
  setPlaybackFailed: (v: boolean) => void;
  url?: string;
  version?: EditingVersion;
  plan?: EditingPlan;
  playbackFailed: boolean;
  onPlaybackError: () => void;
  sourcePending: boolean;
  sourceError: boolean;
  previewError: boolean;
  refreshSource: () => unknown;
  refreshPreview: () => unknown;
  clipDuration: number;
  currentRevisionRendered?: boolean;
  renderPending: boolean;
  renderRunning?: boolean;
  applying: boolean;
  onRender: () => void;
  renderFeedback?: React.ReactNode;
  tools?: React.ReactNode;
  downloadControl?: React.ReactNode;
}) {
  return (
    <section
      className="flex h-full min-h-0 min-w-0 flex-col bg-muted/10"
      aria-label="Video preview"
    >
      <AppTabs
        value={mode}
        className="min-h-0 flex-1 gap-0"
        onValueChange={(v) => {
          onModeChange(v as "original" | "preview");
          setPlaybackFailed(false);
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <AppTabsList size="sm">
            <AppTabsTrigger size="sm" value="original">
              Original
            </AppTabsTrigger>
            <AppTabsTrigger size="sm" value="preview">
              Edited preview
            </AppTabsTrigger>
          </AppTabsList>
          {tools}
        </div>
        <AppTabsContent value={mode} className="mt-0 min-h-0 flex-1">
          <div
            aria-busy={renderRunning}
            className={`studio-canvas flex h-full min-h-0 items-center justify-center overflow-hidden ${renderRunning ? rendering.rendering : ""}`}
          >
            {url && !playbackFailed ? (
              <StudioVideoPlayer
                src={url}
                dockedControls
                fillWorkspace
                showTopBar={false}
                onError={onPlaybackError}
                ariaLabel={
                  mode === "original"
                    ? "Original clip"
                    : `Edited preview revision ${version?.revision}`
                }
                badgeText={
                  mode === "original"
                    ? "Original"
                    : `Preview · r${version?.revision}`
                }
                className="max-w-full"
              />
            ) : mode === "original" && sourcePending ? (
              <div
                role="status"
                aria-label="Loading source video"
                className="flex h-full w-full flex-col items-center justify-center gap-3"
              >
                <AppSpinner size="xs" />
                <span className="text-sm text-muted-foreground">
                  Loading video…
                </span>
              </div>
            ) : (
              <div className="max-w-sm space-y-3 px-4 text-center text-sm leading-6 text-muted-foreground">
                <Video className="mx-auto size-8 text-muted-foreground" />
                <p>
                  {playbackFailed
                    ? "Playback failed. Refresh the authorized media link and try again."
                    : mode === "preview" && version
                      ? version.status === "completed"
                        ? "Loading preview media…"
                        : version.status === "failed"
                          ? "Rendering failed."
                          : version.status === "cancelled"
                            ? "Preview cancelled."
                            : "Your preview is rendering."
                      : mode === "original"
                        ? "Source playback is unavailable."
                        : "Review and apply an edit to create your first preview automatically."}
                </p>
                {(playbackFailed || sourceError || previewError) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="underline focus-visible:ring-2"
                    onClick={() => {
                      setPlaybackFailed(false);
                      void (mode === "original"
                        ? refreshSource()
                        : refreshPreview());
                    }}
                  >
                    Refresh playback link
                  </Button>
                )}
              </div>
            )}
          </div>
        </AppTabsContent>
      </AppTabs>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border/40 px-4 py-3 sm:px-6">
        {renderFeedback || (
          <p className="text-xs text-muted-foreground">
            <span role="status">
              {mode === "original"
                ? "Original clip"
                : version?.status === "completed"
                  ? version.revision === plan?.revision
                    ? `Preview ready · revision ${version.revision}`
                    : `Revision ${version.revision} · newer edits are saved`
                  : version?.status === "failed"
                    ? "Preview failed"
                    : version?.status === "cancelled"
                      ? "Preview cancelled"
                      : version
                        ? "Preview rendering"
                        : "No edited preview yet"}
            </span>{" "}
            ·{" "}
            {editTime(
              mode === "original"
                ? clipDuration
                : (plan?.outputDuration ?? clipDuration),
            )}
            {plan && plan.revision > 1 && !currentRevisionRendered
              ? " · Changes pending"
              : ""}
          </p>
        )}
        {!!plan &&
          plan.revision > 1 &&
          !currentRevisionRendered &&
          !renderRunning &&
          !(
            version?.status === "failed" && version.revision === plan.revision
          ) && (
            <Button
              size="sm"
              variant="secondary"
              disabled={
                !plan ||
                renderPending ||
                renderRunning ||
                applying ||
                !!renderPollInterval(version?.status)
              }
              onClick={() => void onRender()}
            >
              <Video className="size-4" />
              {renderPending
                ? "Preparing preview…"
                : renderRunning
                  ? "Rendering…"
                  : "Render preview"}
            </Button>
          )}
        {downloadControl}
      </div>
    </section>
  );
}

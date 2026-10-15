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
}) {
  return (
    <section
      className="flex min-h-0 min-w-0 flex-col bg-muted/20 lg:h-full"
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
            <AppTabsTrigger size="sm" value="preview" disabled={!version}>
              Edited preview
            </AppTabsTrigger>
          </AppTabsList>
          <span className="text-xs text-muted-foreground">
            {mode === "preview" && version
              ? version.status === "completed"
                ? `Rendered revision ${version.revision}`
                : `Revision ${version.revision} · preview pending`
              : "Source clip"}
          </span>
        </div>
        <AppTabsContent value={mode} className="mt-0 min-h-0 flex-1">
          <div
            aria-busy={renderRunning}
            className={`studio-canvas flex h-[min(34dvh,360px)] min-h-52 items-center justify-center px-4 py-2 lg:h-full lg:min-h-0 lg:px-8 lg:py-4 ${renderRunning ? rendering.rendering : ""}`}
          >
            {url && !playbackFailed ? (
              <StudioVideoPlayer
                src={url}
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
                className="h-full w-auto max-w-full rounded-md border-0 shadow-lg"
              />
            ) : mode === "original" && sourcePending ? (
              <div
                role="status"
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <AppSpinner /> Loading source video…
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
                        : "Apply an edit, then render a preview to see the result."}
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
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <p className="text-xs text-muted-foreground">
          <span role="status">
            {mode === "original"
              ? "Original clip"
              : version?.status === "completed"
                ? "Preview ready"
                : version?.status === "failed"
                  ? "Preview failed"
                  : version?.status === "cancelled"
                    ? "Preview cancelled"
                    : "Preview rendering"}
          </span>{" "}
          ·{" "}
          {editTime(
            mode === "original"
              ? clipDuration
              : (plan?.outputDuration ?? clipDuration),
          )}
          {plan && plan.revision > 0 && !currentRevisionRendered
            ? " · Changes pending"
            : ""}
        </p>
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
      </div>
      {renderFeedback}
    </section>
  );
}

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
  applying,
  onRender,
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
  applying: boolean;
  onRender: () => void;
}) {
  return (
    <section
      className="min-w-0 overflow-hidden rounded-lg border bg-card"
      aria-label="Video preview"
    >
      <AppTabs
        value={mode}
        className="gap-0"
        onValueChange={(v) => {
          onModeChange(v as "original" | "preview");
          setPlaybackFailed(false);
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <AppTabsList size="sm">
            <AppTabsTrigger size="sm" value="original">
              Original
            </AppTabsTrigger>
            <AppTabsTrigger size="sm" value="preview">
              Edited preview
            </AppTabsTrigger>
          </AppTabsList>
          <span className="text-xs text-muted-foreground">
            {mode === "preview" && version
              ? `Rendered revision ${version.revision}`
              : "Source clip"}
          </span>
        </div>
        <AppTabsContent key={mode} value={mode} className="mt-0">
          <div className="flex h-[min(56dvh,520px)] min-h-72 items-center justify-center bg-muted/40 p-3 sm:p-4">
            {url && !playbackFailed ? (
              <StudioVideoPlayer
                key={url}
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
                className="h-full w-auto max-w-full"
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
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          {editTime(clipDuration)} original ·{" "}
          {plan ? `${editTime(plan.outputDuration)} edited` : "Loading plan"}
          {plan && !currentRevisionRendered ? " · Preview needed" : ""}
        </p>
        <Button
          size="sm"
          disabled={
            !plan ||
            renderPending ||
            applying ||
            !!renderPollInterval(version?.status)
          }
          onClick={() => void onRender()}
        >
          <Video className="size-4" />
          {renderPending ? "Preparing preview…" : "Render preview"}
        </Button>
      </div>
    </section>
  );
}

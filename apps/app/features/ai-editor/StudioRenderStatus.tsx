"use client";
import { AppButton, AppSpinner } from "@blynta/ui";
import { Check, CircleAlert } from "lucide-react";
import type { EditingVersion } from "./contracts";
import { renderPollInterval } from "./presentation";
import {
  EDIT_RENDER_PHASE,
  EDIT_RENDER_PHASE_LABEL,
} from "@blynta/types/contracts";

export function StudioRenderStatus({
  version,
  loading,
  error,
  busy,
  onCancel,
  onRetry,
}: {
  version?: EditingVersion;
  loading: boolean;
  error?: string;
  busy: boolean;
  onCancel: () => void;
  onRetry: () => void;
}) {
  const active = !!renderPollInterval(version?.status);
  return (
    <div
      aria-live="polite"
      className="shrink-0 space-y-2 border-t border-border/40 px-4 py-3 sm:px-6"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          {active || loading ? (
            <AppSpinner size="xs" />
          ) : version?.status === "completed" ? (
            <Check className="size-4 text-primary" />
          ) : (
            <CircleAlert className="size-4 text-muted-foreground" />
          )}
          <span>
            {error
              ? "Preview status unavailable"
              : loading
                ? "Loading preview…"
                : version?.status === "queued"
                  ? "Waiting to render"
                  : version?.status === "processing"
                    ? (EDIT_RENDER_PHASE_LABEL[
                        version.phase ?? EDIT_RENDER_PHASE.PREPARING
                      ] ?? "Rendering preview")
                    : version?.status === "completed"
                      ? "Preview ready"
                      : version?.status === "cancelled"
                        ? "Preview cancelled"
                        : "Preview failed"}
          </span>
        </div>
        {active && (
          <AppButton
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </AppButton>
        )}
        {version?.status === "failed" && version.retryable !== false && (
          <AppButton
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={onRetry}
          >
            Retry render
          </AppButton>
        )}
      </div>
      {version?.status === "processing" &&
        version.phase === EDIT_RENDER_PHASE.ENCODING &&
        typeof version.progress === "number" && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              Encoding video —{" "}
              {Math.min(99, Math.max(0, Math.floor(version.progress)))}%
            </p>
            <progress
              aria-label="Video encoding progress"
              max={100}
              value={version.progress}
              className="h-1 w-full accent-primary"
            />
          </div>
        )}
      {(error || version?.error) && (
        <p role="alert" className="text-xs leading-5 text-destructive">
          {error || version?.error}
        </p>
      )}
    </div>
  );
}

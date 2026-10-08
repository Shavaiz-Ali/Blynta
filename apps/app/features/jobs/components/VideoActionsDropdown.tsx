"use client";

import {
  CircleStop,
  ExternalLink,
  MoreVertical,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { AppDropdown } from "@blynta/ui";

export function VideoActionsDropdown({
  sourceUrl,
  cancellationAvailable,
  cancelling,
  canDelete,
  onCancel,
  onDelete,
  onRetryPipeline,
}: {
  sourceUrl?: string;
  cancellationAvailable: boolean;
  cancelling: boolean;
  canDelete: boolean;
  onCancel: () => void;
  onDelete: () => void;
  onRetryPipeline?: () => void;
}) {
  return (
    <AppDropdown
      trigger={
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/80 bg-background text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
          aria-label="Video actions"
        >
          <MoreVertical aria-hidden="true" className="size-4" />
        </button>
      }
      contentClassName="w-56 max-w-[calc(100vw-1rem)] [&_[data-slot=dropdown-menu-item]]:min-h-9 [&_[data-disabled]]:opacity-80 [&_[data-variant=destructive]]:text-red-400 [&_[data-variant=destructive]_span]:text-inherit"
      items={[
        ...(sourceUrl
          ? [
              {
                label: "Open Source Link",
                icon: <ExternalLink className="size-4" />,
                onClick: () =>
                  window.open(sourceUrl, "_blank", "noopener,noreferrer"),
              },
            ]
          : []),
        ...(onRetryPipeline
          ? [
              {
                label: "Retry Pipeline",
                icon: <RefreshCw className="size-4" />,
                onClick: onRetryPipeline,
              },
            ]
          : []),
        ...(cancellationAvailable || cancelling
          ? [
              {
                label: cancelling
                  ? "Cancelling processing…"
                  : "Cancel processing",
                icon: <CircleStop className="size-4" />,
                destructive: !cancelling,
                disabled: cancelling,
                separatorBefore: Boolean(sourceUrl || onRetryPipeline),
                onClick: onCancel,
              },
            ]
          : []),
        ...(canDelete && !cancelling && !cancellationAvailable
          ? [
              {
                label: "Delete video",
                icon: <Trash2 className="size-4" />,
                destructive: true,
                separatorBefore: Boolean(sourceUrl || onRetryPipeline),
                onClick: onDelete,
              },
            ]
          : []),
      ]}
    />
  );
}

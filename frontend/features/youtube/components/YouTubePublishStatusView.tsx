"use client";

import * as React from "react";
import { AppButton } from "@/components/common/AppButton";
import { AppSpinner } from "@/components/common/AppSpinner";
import { CheckCircle2, ExternalLink, RotateCw } from "lucide-react";
import { ClipPublication } from "../types";

export interface YouTubePublishStatusViewProps {
  isUploading: boolean;
  latestPub?: ClipPublication;
  onReupload: () => void;
  onClose: () => void;
}

export function YouTubePublishStatusView({
  isUploading,
  latestPub,
  onReupload,
  onClose,
}: YouTubePublishStatusViewProps) {
  if (isUploading) {
    return (
      <div className="space-y-4 py-2">
        <div className="rounded-xl border border-border/70 bg-muted/30 p-5 text-center space-y-3.5">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary animate-pulse">
            <AppSpinner size="md" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-foreground">
              {latestPub?.status === "queued"
                ? "Publication Queued"
                : "Uploading to YouTube Shorts..."}
            </h4>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
              Your clip is being processed and uploaded directly to your channel in the background.
              You can safely close this dialog or wait here.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end pt-2 border-t border-border/50">
          <AppButton size="sm" onClick={onClose} className="text-xs">
            Close
          </AppButton>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2">
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-center space-y-3.5">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-foreground">
            Published to YouTube Shorts
          </h4>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed font-medium">
            {latestPub?.title}
          </p>
          {latestPub?.publishedAt && (
            <p className="text-[10px] text-muted-foreground/70">
              Published {new Date(latestPub.publishedAt).toLocaleString()}
            </p>
          )}
        </div>
        {latestPub?.externalUrl && (
          <div className="pt-1 flex items-center justify-center gap-2">
            <a
              href={latestPub.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Watch on YouTube
            </a>
          </div>
        )}
      </div>

      {/* Re-upload / Upload again prompt */}
      <div className="rounded-xl border border-border/70 bg-muted/30 p-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground">Need to upload again?</p>
          <p className="text-[11px] text-muted-foreground">
            If you deleted the video on YouTube or want to upload with updated details.
          </p>
        </div>
        <AppButton
          variant="outline"
          size="sm"
          onClick={onReupload}
          icon={<RotateCw className="h-3.5 w-3.5" />}
          className="text-xs shrink-0"
        >
          Re-upload Short
        </AppButton>
      </div>

      <div className="flex items-center justify-end pt-2 border-t border-border/50">
        <AppButton size="sm" onClick={onClose} className="text-xs">
          Close
        </AppButton>
      </div>
    </div>
  );
}

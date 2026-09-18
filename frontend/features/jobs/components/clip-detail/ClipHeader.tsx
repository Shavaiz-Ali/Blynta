"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AppDropdown } from "@/components/common/AppDropdown";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CalendarIcon,
  ChevronLeftIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileTextIcon,
  MoreVerticalIcon,
  Share2Icon,
  TrashIcon,
  YouTubeIcon,
} from "@/features/dashboard/icons";

export interface ClipHeaderProps {
  backHref: string;
  /** Zero-based index of the active clip. */
  clipIndex: number;
  totalClips: number;
  onDownload: () => void;
  isDownloading: boolean;
  onShare: () => void;
  onPublishYouTube?: () => void;
  hasTranscript: boolean;
  onOpenTranscript: () => void;
  sourceUrl?: string;
  onDelete: () => void;
}

/**
 * Page context plus the small set of review utilities.
 *
 * Deliberately limited to review/export actions — anything that edits the clip
 * belongs inside the media workspace, never on the review page. The source
 * video title is already shown in the top bar breadcrumb and in the clip's
 * source link, so this bar stays a single compact row.
 */
export function ClipHeader({
  backHref,
  clipIndex,
  totalClips,
  onDownload,
  isDownloading,
  onShare,
  onPublishYouTube,
  hasTranscript,
  onOpenTranscript,
  sourceUrl,
  onDelete,
}: ClipHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-border/70 pb-3">
      {/* Context */}
      <div className="flex min-w-0 items-center gap-2.5">
        <Link
          href={backHref}
          aria-label="Back to generated shorts"
          title="Back to generated shorts"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </Link>

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight text-foreground">
            Clip review
          </p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            Short {clipIndex + 1} of {Math.max(totalClips, 1)}
          </p>
        </div>
      </div>

      {/* Utility actions */}
      <div className="flex shrink-0 items-center gap-1.5">
        {onPublishYouTube && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onPublishYouTube}
                  aria-label="Publish to YouTube"
                  className="cursor-pointer gap-1.5"
                >
                  <YouTubeIcon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Publish</span>
                </Button>
              }
            />
            <TooltipContent className="text-xs">Publish directly to YouTube</TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                onClick={onShare}
                aria-label="Share clip link"
                className="cursor-pointer gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <Share2Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Share</span>
              </Button>
            }
          />
          <TooltipContent className="text-xs">Copy clip link</TooltipContent>
        </Tooltip>

        {hasTranscript && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onOpenTranscript}
                  aria-label="Open transcript"
                  className="cursor-pointer gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <FileTextIcon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Transcript</span>
                </Button>
              }
            />
            <TooltipContent className="text-xs">Read the transcript</TooltipContent>
          </Tooltip>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={onDownload}
          disabled={isDownloading}
          className="cursor-pointer gap-1.5"
        >
          <DownloadIcon className="h-3.5 w-3.5" />
          <span>{isDownloading ? "Preparing..." : "Download"}</span>
        </Button>

        <AppDropdown
          trigger={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="More actions"
              className="cursor-pointer text-muted-foreground hover:text-foreground"
            >
              <MoreVerticalIcon className="h-4 w-4" />
            </Button>
          }
          items={[
            ...(onPublishYouTube
              ? [
                  {
                    label: "Publish to YouTube",
                    onClick: onPublishYouTube,
                    icon: <YouTubeIcon className="h-3.5 w-3.5" />,
                  },
                ]
              : []),
            { label: "Share link", onClick: onShare, icon: <Share2Icon /> },
            ...(hasTranscript
              ? [
                  {
                    label: "Transcript",
                    onClick: onOpenTranscript,
                    icon: <FileTextIcon />,
                  },
                ]
              : []),
            { label: "Schedule ? coming soon", disabled: true, icon: <CalendarIcon /> },
            ...(sourceUrl
              ? [
                  {
                    label: "Open source video",
                    icon: <ExternalLinkIcon className="h-3.5 w-3.5" />,
                    onClick: () =>
                      window.open(sourceUrl, "_blank", "noopener,noreferrer"),
                  },
                ]
              : []),
            {
              label: "Delete short",
              icon: <TrashIcon className="h-3.5 w-3.5" />,
              onClick: onDelete,
              destructive: true,
              separatorBefore: true,
            },
          ]}
        />
      </div>
    </header>
  );
}
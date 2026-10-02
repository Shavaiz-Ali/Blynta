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
  title: string;
  /** Zero-based index of the active clip. */
  clipIndex: number;
  totalClips: number;
  onDownload: () => void;
  isDownloading: boolean;
  onShare: () => void;
  onPublishYouTube?: () => void;
  onSchedule?: () => void;
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
  title,
  clipIndex,
  totalClips,
  onDownload,
  isDownloading,
  onShare,
  onPublishYouTube,
  onSchedule,
  hasTranscript,
  onOpenTranscript,
  sourceUrl,
  onDelete,
}: ClipHeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Context */}
      <div className="flex min-w-0 items-center gap-2.5">
        <Link
          href={backHref}
          aria-label="Back to generated shorts"
          title="Back to generated shorts"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-card text-muted-foreground shadow-xs transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </Link>

        <div className="min-w-0">
          <p className="max-w-[min(65vw,36rem)] truncate text-sm font-semibold tracking-tight text-foreground sm:max-w-[20rem] lg:max-w-[32rem]">
            {title}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            Short {clipIndex + 1} of {Math.max(totalClips, 1)}
          </p>
        </div>
      </div>

      {/* Utility actions */}
      <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0">
        {onPublishYouTube && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onPublishYouTube}
                  aria-label="Publish to YouTube"
                  className="h-9 flex-1 cursor-pointer gap-1.5 px-4 sm:flex-none"
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
                className="hidden h-9 cursor-pointer gap-1.5 text-muted-foreground hover:text-foreground md:inline-flex"
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
                  className="hidden h-9 cursor-pointer gap-1.5 text-muted-foreground hover:text-foreground lg:inline-flex"
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
          className="h-9 flex-1 cursor-pointer gap-1.5 px-4 sm:flex-none"
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
              className="h-9 w-9 cursor-pointer text-muted-foreground hover:text-foreground"
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
            ...(onSchedule
              ? [{ label: "Schedule post", onClick: onSchedule, icon: <CalendarIcon /> }]
              : []),
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

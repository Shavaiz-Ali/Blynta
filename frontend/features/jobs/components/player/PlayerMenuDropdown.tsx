"use client";

import { AppDropdown, AppDropdownItemConfig } from "@/components/common";
import { DownloadIcon, TrashIcon, TypeIcon } from "@/features/dashboard/icons";

interface PlayerMenuDropdownProps {
  onDownloadTranscript?: () => void;
  onDownloadSubtitles?: () => void;
  onDeleteClip?: () => void;
  hasTranscript?: boolean;
}

export function PlayerMenuDropdown({
  onDownloadTranscript,
  onDownloadSubtitles,
  onDeleteClip,
  hasTranscript = true,
}: PlayerMenuDropdownProps) {
  const items: AppDropdownItemConfig[] = [];

  if (onDownloadTranscript) {
    items.push({
      key: "transcript",
      label: "Download Transcript",
      description: "Plain text (.txt)",
      icon: <TypeIcon className="h-3.5 w-3.5" />,
      disabled: !hasTranscript,
      onClick: onDownloadTranscript,
    });
  }

  if (onDownloadSubtitles) {
    items.push({
      key: "subtitles",
      label: "Download Subtitles",
      description: "SubRip format (.srt)",
      icon: <DownloadIcon className="h-3.5 w-3.5" />,
      disabled: !hasTranscript,
      onClick: onDownloadSubtitles,
    });
  }

  if (onDeleteClip) {
    items.push({
      key: "delete",
      label: "Delete Clip",
      description: "Permanently remove clip",
      icon: <TrashIcon className="h-3.5 w-3.5" />,
      destructive: true,
      separatorBefore: items.length > 0,
      onClick: onDeleteClip,
    });
  }

  const trigger = (
    <button
      type="button"
      className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/75 hover:bg-black/90 backdrop-blur-md text-white/90 hover:text-white border border-white/15 shadow-sm transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary data-[state=open]:bg-black data-[state=open]:text-primary data-[state=open]:border-primary/40"
      title="More Options"
      aria-label="Player options menu"
    >
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
        <circle cx="5" cy="12" r="1" />
      </svg>
    </button>
  );

  return (
    <div className="relative inline-block pointer-events-auto">
      <AppDropdown
        trigger={trigger}
        label="Clip Options"
        items={items}
        align="end"
        side="bottom"
      />
    </div>
  );
}

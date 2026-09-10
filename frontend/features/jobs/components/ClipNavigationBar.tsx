"use client";

import { useRouter } from "next/navigation";
import { Clip } from "@/features/jobs";
import { AppButton } from "@/components/common/AppButton";
import { ChevronLeftIcon, ChevronRightIcon, FilmIcon } from "@/features/dashboard/icons";
import { cn } from "@/lib/utils";

export interface ClipNavigationBarProps {
  jobId: string;
  clips: Clip[];
  activeClipIndex: number;
}

export function ClipNavigationBar({
  jobId,
  clips,
  activeClipIndex,
}: ClipNavigationBarProps) {
  const router = useRouter();
  const totalClips = clips.length;

  if (totalClips <= 1) return null;

  const prevClip = activeClipIndex > 0 ? clips[activeClipIndex - 1] : null;
  const nextClip = activeClipIndex < totalClips - 1 ? clips[activeClipIndex + 1] : null;

  const getClipId = (c: Clip) => c._id || c.id;

  const handleNavigate = (c: Clip) => {
    const cid = getClipId(c);
    if (cid) {
      router.push(`/my-clips/${jobId}/clips/${cid}`);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-md border border-border/80 bg-card/70 backdrop-blur-sm shadow-2xs w-full">
      {/* Left: Previous Clip Button */}
      <AppButton
        variant="outline"
        size="sm"
        disabled={!prevClip}
        onClick={() => prevClip && handleNavigate(prevClip)}
        icon={<ChevronLeftIcon className="h-4 w-4" />}
        className="h-8 text-xs font-semibold w-full sm:w-auto"
      >
        Previous Clip
      </AppButton>

      {/* Center: Clip Thumbnails / Pill Selector Strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-full">
        <span className="text-xs font-semibold text-muted-foreground mr-1 shrink-0">
          Clip {activeClipIndex + 1} of {totalClips}:
        </span>
        {clips.map((clip, idx) => {
          const isActive = idx === activeClipIndex;
          const cid = getClipId(clip);
          return (
            <button
              key={cid || idx}
              type="button"
              onClick={() => handleNavigate(clip)}
              className={cn(
                "h-7 min-w-7 px-2.5 rounded-md text-xs font-semibold font-mono transition-all cursor-pointer select-none flex items-center justify-center shrink-0",
                isActive
                  ? "bg-primary text-primary-foreground border border-primary shadow-xs"
                  : "bg-muted/50 border border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted/80"
              )}
              title={`Jump to Short #${idx + 1}`}
            >
              #{idx + 1}
            </button>
          );
        })}
      </div>

      {/* Right: Next Clip Button */}
      <AppButton
        variant="outline"
        size="sm"
        disabled={!nextClip}
        onClick={() => nextClip && handleNavigate(nextClip)}
        icon={<ChevronRightIcon className="h-4 w-4" />}
        iconPosition="right"
        className="h-8 text-xs font-semibold w-full sm:w-auto"
      >
        Next Clip
      </AppButton>
    </div>
  );
}

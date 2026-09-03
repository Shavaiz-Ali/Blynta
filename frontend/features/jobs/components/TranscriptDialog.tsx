"use client";

import * as React from "react";
import { AppDialog } from "@/components/common/AppDialog";
import { AppButton } from "@/components/common/AppButton";
import { TranscriptSegment } from "@/features/jobs/types";
import { formatTimestamp } from "@/features/dashboard/utils";
import {
  DownloadIcon,
  SearchIcon,
  CheckIcon,
  TypeIcon,
} from "@/features/dashboard/icons";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TranscriptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transcript?: TranscriptSegment[];
  jobTitle?: string;
  jobId?: string;
  activeRange?: { startTime: number; endTime: number };
}

export function formatSrtTimestamp(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);

  const pad = (n: number, z = 2) => String(n).padStart(z, "0");
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)},${pad(millis, 3)}`;
}

export function downloadTranscriptAsTxt(
  transcript: TranscriptSegment[],
  filename = "transcript.txt"
) {
  if (!transcript || transcript.length === 0) return;
  const content = transcript
    .map((seg) => `[${formatTimestamp(seg.startTime)}] ${seg.text}`)
    .join("\n\n");

  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadTranscriptAsSrt(
  transcript: TranscriptSegment[],
  filename = "transcript.srt"
) {
  if (!transcript || transcript.length === 0) return;
  const content = transcript
    .map((seg, idx) => {
      const index = idx + 1;
      const start = formatSrtTimestamp(seg.startTime);
      const end = formatSrtTimestamp(seg.endTime);
      return `${index}\n${start} --> ${end}\n${seg.text}\n`;
    })
    .join("\n");

  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function TranscriptDialog({
  open,
  onOpenChange,
  transcript = [],
  jobTitle = "Video",
  jobId = "",
  activeRange,
}: TranscriptDialogProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [copied, setCopied] = React.useState(false);

  const filteredSegments = React.useMemo(() => {
    if (!transcript) return [];
    if (!searchQuery.trim()) return transcript;
    const q = searchQuery.toLowerCase();
    return transcript.filter((seg) => seg.text.toLowerCase().includes(q));
  }, [transcript, searchQuery]);

  const totalWords = React.useMemo(() => {
    return transcript.reduce(
      (acc, seg) => acc + seg.text.trim().split(/\s+/).filter(Boolean).length,
      0
    );
  }, [transcript]);

  function handleCopyAll() {
    if (!transcript.length) return;
    const text = transcript
      .map((seg) => `[${formatTimestamp(seg.startTime)}] ${seg.text}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Transcript copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownloadTxt() {
    const safeTitle = (jobTitle || "transcript").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30);
    downloadTranscriptAsTxt(transcript, `${safeTitle}-${jobId || "job"}.txt`);
    toast.success("Downloaded transcript (.txt)");
  }

  function handleDownloadSrt() {
    const safeTitle = (jobTitle || "transcript").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30);
    downloadTranscriptAsSrt(transcript, `${safeTitle}-${jobId || "job"}.srt`);
    toast.success("Downloaded subtitles (.srt)");
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Video Transcript"
      description={`${transcript.length} segments · ~${totalWords.toLocaleString()} words · Timestamps aligned to audio`}
      footer={
        <div className="flex flex-wrap items-center justify-between w-full gap-2">
          <div className="flex items-center gap-2">
            <AppButton
              variant="outline"
              size="sm"
              onClick={handleDownloadTxt}
              icon={<DownloadIcon className="h-3.5 w-3.5" />}
            >
              Download .txt
            </AppButton>
            <AppButton
              variant="outline"
              size="sm"
              onClick={handleDownloadSrt}
              icon={<DownloadIcon className="h-3.5 w-3.5" />}
            >
              Download .srt
            </AppButton>
          </div>
          <div className="flex items-center gap-2">
            <AppButton
              variant="outline"
              size="sm"
              onClick={handleCopyAll}
              icon={
                copied ? (
                  <CheckIcon className="h-3.5 w-3.5 text-chart-1" />
                ) : (
                  <TypeIcon className="h-3.5 w-3.5" />
                )
              }
            >
              {copied ? "Copied" : "Copy Text"}
            </AppButton>
            <AppButton size="sm" onClick={() => onOpenChange(false)}>
              Done
            </AppButton>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        {/* Search input */}
        <div className="relative">
          <SearchIcon className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search within transcript..."
            className="w-full h-9 pl-9 pr-3 text-xs sm:text-sm rounded-xl bg-card border border-border/70 text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/40 transition-all"
          />
        </div>

        {/* Transcript Segments List */}
        <div className="max-h-[440px] overflow-y-auto rounded-xl border border-border/70 bg-muted/20 p-3 space-y-2">
          {filteredSegments.length > 0 ? (
            filteredSegments.map((seg, idx) => {
              const inRange =
                activeRange &&
                seg.startTime >= activeRange.startTime - 0.5 &&
                seg.endTime <= activeRange.endTime + 0.5;

              return (
                <div
                  key={idx}
                  className={cn(
                    "flex items-start gap-3 p-2.5 rounded-lg transition-colors text-xs leading-relaxed",
                    inRange
                      ? "bg-primary/10 border border-primary/25 text-foreground font-medium"
                      : "hover:bg-muted/50 text-foreground/85"
                  )}
                >
                  <span className="shrink-0 font-mono text-[11px] text-primary/80 pt-0.5 select-none min-w-[50px] tabular-nums font-semibold">
                    [{formatTimestamp(seg.startTime)}]
                  </span>
                  <p className="flex-1 text-xs sm:text-sm leading-relaxed">
                    {seg.text}
                  </p>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-xs text-muted-foreground">
              {searchQuery
                ? `No segments matching "${searchQuery}"`
                : "No transcript segments available."}
            </div>
          )}
        </div>
      </div>
    </AppDialog>
  );
}

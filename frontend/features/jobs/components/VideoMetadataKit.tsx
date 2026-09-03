"use client";

import * as React from "react";
import { Job, Highlight } from "@/features/jobs/types";
import { AppButton } from "@/components/common/AppButton";
import {
  SparklesIcon,
  CopyIcon,
  CheckIcon,
  TagIcon,
  HashIcon,
  FileTextIcon,
  CheckCheckIcon,
  FilmIcon,
} from "@/features/dashboard/icons";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface VideoMetadataKitProps {
  job: Job;
  activeHighlight?: Highlight;
  clipIndex?: number;
  className?: string;
}

export function VideoMetadataKit({
  job,
  activeHighlight,
  clipIndex,
  className,
}: VideoMetadataKitProps) {
  const [copiedSection, setCopiedSection] = React.useState<string | null>(null);
  const [copiedItem, setCopiedItem] = React.useState<string | null>(null);

  // Parse keywords: either comma-separated string or array
  const rawKeywords = job.keywords || "";
  const keywordsList: string[] = React.useMemo(() => {
    if (Array.isArray(rawKeywords)) return rawKeywords;
    if (typeof rawKeywords === "string" && rawKeywords.trim()) {
      return rawKeywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
    }
    // Fallback to active highlight tags if video-level keywords aren't present
    if (activeHighlight?.tags && activeHighlight.tags.length > 0) {
      return activeHighlight.tags;
    }
    return [];
  }, [rawKeywords, activeHighlight?.tags]);

  // Parse hashtags: string array or extract from tags
  const hashtagsList: string[] = React.useMemo(() => {
    if (job.hashtags && job.hashtags.length > 0) {
      return job.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`));
    }
    if (activeHighlight?.tags && activeHighlight.tags.length > 0) {
      return activeHighlight.tags.map((t) => (t.startsWith("#") ? t : `#${t}`));
    }
    return [];
  }, [job.hashtags, activeHighlight?.tags]);

  const videoDescription = job.videoDescription?.trim() || "";
  const videoTitle = job.videoTitle?.trim() || "";
  const clipTitle = activeHighlight?.clipTitle?.trim() || "";
  const clipStyle = activeHighlight?.style?.trim() || "";

  const hasAnyMetadata = Boolean(
    videoDescription || keywordsList.length > 0 || hashtagsList.length > 0
  );

  async function copyToClipboard(text: string, label: string, sectionKey?: string) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      if (sectionKey) {
        setCopiedSection(sectionKey);
        setTimeout(() => setCopiedSection(null), 2000);
      } else {
        setCopiedItem(label);
        setTimeout(() => setCopiedItem(null), 1800);
      }
      toast.success(`Copied ${label} to clipboard!`);
    } catch {
      toast.error("Failed to copy to clipboard.");
    }
  }

  function handleCopyAllKit() {
    const parts: string[] = [];
    if (videoTitle) parts.push(`Title: ${videoTitle}`);
    if (videoDescription) parts.push(`\nDescription:\n${videoDescription}`);
    if (hashtagsList.length > 0) parts.push(`\nHashtags:\n${hashtagsList.join(" ")}`);
    if (keywordsList.length > 0) parts.push(`\nKeywords:\n${keywordsList.join(", ")}`);

    copyToClipboard(parts.join("\n"), "Complete Social Kit", "all");
  }

  if (!hasAnyMetadata) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-2xs space-y-5",
        className
      )}
    >
      {/* Card Header: Title + Quick Copy All Kit */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border/70">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
            <SparklesIcon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
              <span>AI SEO &amp; Social Growth Kit</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25">
                Viral Ready
              </span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Optimized titles, feed copy, search keywords, and trending hashtags for high engagement.
            </p>
          </div>
        </div>

        <AppButton
          variant="outline"
          size="sm"
          onClick={handleCopyAllKit}
          icon={
            copiedSection === "all" ? (
              <CheckCheckIcon className="h-3.5 w-3.5 text-primary" />
            ) : (
              <CopyIcon className="h-3.5 w-3.5" />
            )
          }
          className="h-8 text-xs font-semibold shrink-0"
          title="Copy title, description, and hashtags formatted for posting"
        >
          {copiedSection === "all" ? "Kit Copied!" : "Copy Full Kit"}
        </AppButton>
      </div>

      {/* Grid: Description & Feed Copy (Left) + Hashtags & Keywords (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: AI Feed Description & Clip Style */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {videoDescription && (
            <div className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-2.5 flex-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <FileTextIcon className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">
                    Feed Caption / Description
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(videoDescription, "description", "desc")
                  }
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer"
                >
                  {copiedSection === "desc" ? (
                    <>
                      <CheckIcon className="h-3 w-3" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <CopyIcon className="h-3 w-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap font-sans">
                {videoDescription}
              </p>
            </div>
          )}

          {/* Active Clip Highlights Overview */}
          {(clipTitle || clipStyle) && (
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 flex flex-wrap items-center justify-between gap-2.5 text-xs">
              <div className="flex items-center gap-2">
                <FilmIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground font-medium">
                  {typeof clipIndex === "number" ? `Clip ${clipIndex + 1}:` : "Selected Clip:"}
                </span>
                <span className="font-semibold text-foreground truncate max-w-[200px] sm:max-w-[280px]">
                  {clipTitle || "Featured Moment"}
                </span>
              </div>

              {clipStyle && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Style:</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 text-[11px] font-mono font-semibold">
                    {clipStyle}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Trending Hashtags & SEO Keywords */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Trending Hashtags */}
          {hashtagsList.length > 0 && (
            <div className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <HashIcon className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">
                    Trending Hashtags ({hashtagsList.length})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(hashtagsList.join(" "), "all hashtags", "hashtags")
                  }
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer"
                >
                  {copiedSection === "hashtags" ? (
                    <>
                      <CheckIcon className="h-3 w-3" />
                      <span>Copied All</span>
                    </>
                  ) : (
                    <>
                      <CopyIcon className="h-3 w-3" />
                      <span>Copy All</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {hashtagsList.map((tag, idx) => {
                  const isTagCopied = copiedItem === tag;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => copyToClipboard(tag, tag)}
                      className={cn(
                        "group inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer border",
                        isTagCopied
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-card hover:bg-muted text-foreground/85 border-border/80 hover:border-primary/50"
                      )}
                      title="Click to copy this hashtag"
                    >
                      <span>{tag}</span>
                      {isTagCopied ? (
                        <CheckIcon className="h-2.5 w-2.5 shrink-0" />
                      ) : (
                        <CopyIcon className="h-2.5 w-2.5 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* SEO Keywords & Search Terms */}
          {keywordsList.length > 0 && (
            <div className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <TagIcon className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">
                    SEO Keywords ({keywordsList.length})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(keywordsList.join(", "), "all keywords", "keywords")
                  }
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer"
                >
                  {copiedSection === "keywords" ? (
                    <>
                      <CheckIcon className="h-3 w-3" />
                      <span>Copied All</span>
                    </>
                  ) : (
                    <>
                      <CopyIcon className="h-3 w-3" />
                      <span>Copy All</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {keywordsList.map((kw, idx) => {
                  const isKwCopied = copiedItem === kw;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => copyToClipboard(kw, kw)}
                      className={cn(
                        "group inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer border",
                        isKwCopied
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-card hover:bg-muted text-foreground/80 border-border/80 hover:border-primary/50"
                      )}
                      title="Click to copy keyword"
                    >
                      <span>{kw}</span>
                      {isKwCopied ? (
                        <CheckIcon className="h-2.5 w-2.5 shrink-0" />
                      ) : (
                        <CopyIcon className="h-2.5 w-2.5 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

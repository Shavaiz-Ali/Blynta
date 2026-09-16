"use client";

import * as React from "react";
import { Highlight, Job } from "@/features/jobs";
import {
  CopyIcon,
  CheckCircleIcon,
  Share2Icon,
} from "@/features/dashboard/icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export interface SocialContentSectionProps {
  job: Job;
  highlight?: Highlight;
  clipTitle: string;
}

export function SocialContentSection({
  job,
  highlight,
  clipTitle,
}: SocialContentSectionProps) {
  const [copiedField, setCopiedField] = React.useState<string | null>(null);

  const descriptionText =
    highlight?.clipDescription ||
    highlight?.reason ||
    "Watch this high-retention AI extracted short clip from " +
    (job.videoTitle || "the source video") +
    ".";

  // SEO Keywords
  const keywords = React.useMemo(() => {
    const list = new Set<string>();
    if (job.keywords) {
      job.keywords.split(",").forEach((k) => {
        const trimmed = k.trim().replace(/^#/, "");
        if (trimmed) list.add(trimmed);
      });
    }
    if (highlight?.tags) {
      highlight.tags.forEach((t) => list.add(t.replace(/^#/, "")));
    }
    if (list.size === 0) {
      list.add("shorts");
      list.add("viral");
      list.add("video");
    }
    return Array.from(list).slice(0, 10);
  }, [job.keywords, highlight?.tags]);

  // Hashtags
  const hashtags = React.useMemo(() => {
    const list = new Set<string>();
    if (job.hashtags) {
      job.hashtags.forEach((h) => {
        const tag = h.startsWith("#") ? h : `#${h}`;
        list.add(tag);
      });
    }
    if (highlight?.tags) {
      highlight.tags.forEach((t) => {
        const tag = t.startsWith("#") ? t : `#${t}`;
        list.add(tag);
      });
    }
    if (list.size === 0) {
      keywords.forEach((k) => list.add(`#${k}`));
    }
    return Array.from(list).slice(0, 10);
  }, [job.hashtags, highlight?.tags, keywords]);

  const triggerCopy = (text: string, label: string, fieldKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    toast.success(`${label} copied to clipboard!`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleCopyAllPackage = () => {
    const fullPackage = `${clipTitle}\n\n${descriptionText}\n\n${hashtags.join(" ")}`;
    triggerCopy(fullPackage, "Complete post package", "all");
  };

  return (
    <div className="rounded-lg border border-border/80 bg-card/60 p-4 sm:p-5 space-y-4 h-full flex flex-col justify-between shadow-2xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          <Share2Icon className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
            Publishing Package
          </h3>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyAllPackage}
          className="h-7 text-xs font-semibold self-start sm:self-center cursor-pointer border-border hover:bg-muted"
        >
          {copiedField === "all" ? (
            <>
              <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-500 mr-1.5" />
              <span>Copied Package</span>
            </>
          ) : (
            <>
              <CopyIcon className="h-3.5 w-3.5 mr-1.5" />
              <span>Copy Full Package</span>
            </>
          )}
        </Button>
      </div>

      {/* Content Fields */}
      <div className="space-y-3.5 flex-1">
        {/* ── Optimized Title ── */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground">Optimized Title</span>
            <button
              type="button"
              onClick={() => triggerCopy(clipTitle, "Title", "title")}
              className="text-[11px] text-primary hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
            >
              {copiedField === "title" ? (
                <>
                  <CheckCircleIcon className="h-3 w-3 text-emerald-500" />
                  <span className="text-emerald-500">Copied</span>
                </>
              ) : (
                <>
                  <CopyIcon className="h-3 w-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          <div className="p-2.5 rounded-md bg-muted/20 border border-border/50 text-xs font-medium text-foreground leading-relaxed select-text">
            {clipTitle}
          </div>
        </div>

        {/* ── Social Caption ── */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground">Social Caption</span>
            <button
              type="button"
              onClick={() => triggerCopy(descriptionText, "Description", "description")}
              className="text-[11px] text-primary hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
            >
              {copiedField === "description" ? (
                <>
                  <CheckCircleIcon className="h-3 w-3 text-emerald-500" />
                  <span className="text-emerald-500">Copied</span>
                </>
              ) : (
                <>
                  <CopyIcon className="h-3 w-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          <div className="p-2.5 rounded-md bg-muted/20 border border-border/50 text-xs text-muted-foreground leading-relaxed select-text">
            {descriptionText}
          </div>
        </div>

        {/* ── SEO Keywords ── */}
        {keywords.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground">SEO Keywords</span>
              <button
                type="button"
                onClick={() => triggerCopy(keywords.join(", "), "Keywords", "keywords")}
                className="text-[11px] text-primary hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
              >
                {copiedField === "keywords" ? (
                  <>
                    <CheckCircleIcon className="h-3 w-3 text-emerald-500" />
                    <span className="text-emerald-500">Copied All</span>
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
              {keywords.map((kw) => (
                <Badge
                  key={kw}
                  variant="outline"
                  onClick={() => triggerCopy(kw, `Keyword "${kw}"`, `kw-${kw}`)}
                  className="cursor-pointer hover:border-primary/50 text-[10px] font-mono px-2 py-0.5 rounded-md border-border/70 bg-muted/20"
                >
                  {kw}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* ── Trending Hashtags ── */}
        {hashtags.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground">Trending Hashtags</span>
              <button
                type="button"
                onClick={() => triggerCopy(hashtags.join(" "), "Hashtags", "hashtags")}
                className="text-[11px] text-primary hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
              >
                {copiedField === "hashtags" ? (
                  <>
                    <CheckCircleIcon className="h-3 w-3 text-emerald-500" />
                    <span className="text-emerald-500">Copied All</span>
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
              {hashtags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  onClick={() => triggerCopy(tag, `Hashtag "${tag}"`, `tag-${tag}`)}
                  className="cursor-pointer bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 text-[10px] font-semibold px-2 py-0.5 rounded-md"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}



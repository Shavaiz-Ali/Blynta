"use client";

import * as React from "react";
import { Highlight, Job } from "@/features/jobs";
import {
  CopyIcon,
  CheckCircleIcon,
  SparklesIcon,
} from "@/features/dashboard/icons";
import { AppButton } from "@/components/common/AppButton";
import { AppCard } from "@/components/common/AppCard";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

  // SEO Keywords (un-hashed)
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

  // Hashtags (with #)
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
    <AppCard className="space-y-4!" useDefaultClasses={false}>
      {/* ── Section Header ── */}
      <div className="flex items-center justify-between pb-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center text-primary">
            <SparklesIcon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Ready to Publish
            </h3>
            <p className="text-[11px] text-muted-foreground">
              AI-generated social captions & SEO keywords
            </p>
          </div>
        </div>

        <AppButton
          variant="outline"
          size="sm"
          onClick={handleCopyAllPackage}
          icon={
            copiedField === "all" ? (
              <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <CopyIcon className="h-3.5 w-3.5" />
            )
          }
          className="h-8 text-xs font-semibold"
        >
          {copiedField === "all" ? "Copied All" : "Copy Full Package"}
        </AppButton>
      </div>

      {/* ── Title Field ── */}
      <div className="space-y-1.5 my-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-foreground">Generated Title</span>
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
        <div className="p-2.5 rounded-md bg-background/50 border border-input text-xs font-medium text-foreground leading-relaxed">
          {clipTitle}
        </div>
      </div>

      {/* ── Description Field ── */}
      <div className="space-y-1.5 my-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-foreground">Generated Description</span>
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
        <div className="p-3 rounded-md bg-background/50 border border-input text-xs text-muted-foreground leading-relaxed">
          {descriptionText}
        </div>
      </div>

      {/* ── SEO Keywords ── */}
      {keywords.length > 0 && (
        <div className="space-y-1.5">
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
          <div className="flex flex-wrap gap-1.5 pt-0.5 my-2">
            {keywords.map((kw) => (
              <Badge
                key={kw}
                variant="outline"
                onClick={() => triggerCopy(kw, `Keyword "${kw}"`, `kw-${kw}`)}
                className="cursor-pointer hover:border-primary/50 text-[11px] font-mono px-2 py-0.5"
              >
                {kw}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* ── Trending Hashtags ── */}
      {hashtags.length > 0 && (
        <div className="space-y-1.5">
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
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {hashtags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                onClick={() => triggerCopy(tag, `Hashtag "${tag}"`, `tag-${tag}`)}
                className="cursor-pointer bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 text-[11px] font-semibold px-2 py-0.5"
              >
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </AppCard>
  );
}

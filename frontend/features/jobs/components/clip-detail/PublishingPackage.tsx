"use client";

import * as React from "react";
import { Highlight, Job } from "@/features/jobs";
import { AppCard } from "@/components/common";
import { AppDropdown } from "@/components/common/AppDropdown";
import { Button } from "@/components/ui/button";
import {
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  FileTextIcon,
  HashIcon,
  SendIcon,
  TagIcon,
  TypeIcon,
} from "@/features/dashboard/icons";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface PublishingPackageProps {
  job: Job;
  highlight?: Highlight;
  clipTitle: string;
  className?: string;
}

const CARD_LABEL_CLASS =
  "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

/**
 * What the user can publish. Each content type gets its own card so the
 * section scans quickly; a single copy menu in the section header handles
 * every copy action.
 */
export function PublishingPackage({
  job,
  highlight,
  clipTitle,
  className,
}: PublishingPackageProps) {
  const [copied, setCopied] = React.useState(false);
  const copiedTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
    };
  }, []);

  const descriptionText =
    highlight?.clipDescription ||
    highlight?.reason ||
    `Watch this high-retention AI extracted short clip from ${job.videoTitle || "the source video"}.`;

  // Preserve keyword derivation: job keywords + highlight tags, stripped of leading #.
  const keywords = React.useMemo(() => {
    const list = new Set<string>();
    if (job.keywords) {
      job.keywords.split(",").forEach((k) => {
        const trimmed = k.trim().replace(/^#/, "");
        if (trimmed) list.add(trimmed);
      });
    }
    highlight?.tags?.forEach((t) => list.add(t.replace(/^#/, "")));
    if (list.size === 0) {
      ["shorts", "viral", "video"].forEach((k) => list.add(k));
    }
    return Array.from(list).slice(0, 10);
  }, [job.keywords, highlight?.tags]);

  // Preserve hashtag derivation: job.hashtags + highlight tags, with fallback to keywords.
  const hashtags = React.useMemo(() => {
    const list = new Set<string>();
    job.hashtags?.forEach((h) => {
      list.add(h.startsWith("#") ? h : `#${h}`);
    });
    highlight?.tags?.forEach((t) => {
      list.add(t.startsWith("#") ? t : `#${t}`);
    });
    if (list.size === 0) {
      keywords.forEach((k) => list.add(`#${k}`));
    }
    return Array.from(list).slice(0, 10);
  }, [job.hashtags, highlight?.tags, keywords]);

  const packageText = `${clipTitle}\n\n${descriptionText}\n\n${hashtags.join(" ")}`;

  const copy = React.useCallback((text: string, label: string) => {
    if (!text) {
      toast.error(`Nothing to copy for ${label.toLowerCase()}`);
      return;
    }
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
        copiedTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
        toast.success(`${label} copied`);
      })
      .catch(() => toast.error("Failed to copy"));
  }, []);

  const copyItems = [
    {
      key: "package",
      label: "Copy package",
      description: "Title, caption & hashtags",
      icon: <SendIcon className="h-3.5 w-3.5" />,
      onClick: () => copy(packageText, "Publishing package"),
    },
    {
      key: "title",
      label: "Copy title",
      description: "Paste-ready clip title",
      icon: <TypeIcon className="h-3.5 w-3.5" />,
      onClick: () => copy(clipTitle, "Title"),
      separatorBefore: true,
    },
    {
      key: "caption",
      label: "Copy caption",
      description: "Paste-ready caption",
      icon: <FileTextIcon className="h-3.5 w-3.5" />,
      onClick: () => copy(descriptionText, "Caption"),
    },
    {
      key: "keywords",
      label: "Copy SEO keywords",
      description: `${keywords.length} keyword${keywords.length === 1 ? "" : "s"}`,
      icon: <TagIcon className="h-3.5 w-3.5" />,
      onClick: () => copy(keywords.join(", "), "SEO keywords"),
    },
    {
      key: "hashtags",
      label: "Copy hashtags",
      description: `${hashtags.length} hashtag${hashtags.length === 1 ? "" : "s"}`,
      icon: <HashIcon className="h-3.5 w-3.5" />,
      onClick: () => copy(hashtags.join(" "), "Hashtags"),
    },
  ];

  return (
    <section className={cn("space-y-3", className)} aria-label="Publishing content">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
          <SendIcon className="h-3.5 w-3.5 text-primary" />
          Publishing content
        </h2>

        <AppDropdown
          align="end"
          label="Copy to clipboard"
          items={copyItems}
          trigger={
            <Button
              variant="ghost"
              size="sm"
              aria-label="Copy publishing content"
              title="Copy publishing content"
              className="cursor-pointer gap-1.5 text-muted-foreground hover:text-foreground"
            >
              {copied ? (
                <CheckIcon className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <CopyIcon className="h-3.5 w-3.5" />
              )}
              <span className="text-xs font-medium">Copy</span>
              <ChevronDownIcon className="h-3 w-3 opacity-70" />
            </Button>
          }
        />
      </div>

      {/* One card per content type — read-only review, never a form */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <AppCard
          size="sm"
          title="Title"
          titleClassName={CARD_LABEL_CLASS}
          contentClassName="px-3 pb-0"
        >
          <p className="select-text text-sm font-semibold leading-relaxed text-foreground">
            {clipTitle}
          </p>
        </AppCard>

        <AppCard
          size="sm"
          title="SEO keywords"
          titleClassName={CARD_LABEL_CLASS}
          contentClassName="px-3 pb-0"
        >
          <p className="select-text text-sm leading-relaxed text-muted-foreground">
            {keywords.join(" \u00b7 ")}
          </p>
        </AppCard>

        <AppCard
          size="sm"
          title="Caption"
          titleClassName={CARD_LABEL_CLASS}
          contentClassName="px-3 pb-0"
        >
          <p className="max-w-prose select-text text-sm leading-relaxed text-muted-foreground">
            {descriptionText}
          </p>
        </AppCard>

        <AppCard
          size="sm"
          title="Hashtags"
          titleClassName={CARD_LABEL_CLASS}
          contentClassName="px-3 pb-0"
        >
          <p className="select-text text-sm leading-relaxed text-primary">{hashtags.join("  ")}</p>
        </AppCard>
      </div>
    </section>
  );
}
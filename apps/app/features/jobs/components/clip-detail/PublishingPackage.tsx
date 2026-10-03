"use client";

import * as React from "react";
import { Highlight, Job } from "@/features/jobs";
import { AppDropdown } from "@blynta/ui";
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
  const [copiedField, setCopiedField] = React.useState<string | null>(null);
  const copiedTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

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

  const copy = React.useCallback(
    (text: string, label: string, field?: string) => {
      if (!text) {
        toast.error(`Nothing to copy for ${label.toLowerCase()}`);
        return;
      }
      navigator.clipboard
        .writeText(text)
        .then(() => {
          setCopied(true);
          setCopiedField(field ?? null);
          if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
          copiedTimeoutRef.current = setTimeout(() => {
            setCopied(false);
            setCopiedField(null);
          }, 2000);
          toast.success(`${label} copied`);
        })
        .catch(() => toast.error("Failed to copy"));
    },
    [],
  );

  const copyItems = [
    {
      key: "package",
      label: "Copy package",
      description: "Title, description & hashtags",
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
      key: "description",
      label: "Copy description",
      description: "Paste-ready description",
      icon: <FileTextIcon className="h-3.5 w-3.5" />,
      onClick: () => copy(descriptionText, "Description"),
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
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xs",
        className,
      )}
      aria-label="Publishing content"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border/70 px-5 py-4 sm:px-6">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
            Ready-to-publish content
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Copy everything at once or use individual fields.
          </p>
        </div>

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
              className="cursor-pointer gap-1.5 border border-border/70 bg-background text-muted-foreground hover:text-foreground"
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

      <div className="grid gap-px bg-border/70 sm:grid-cols-2">
        <ContentBlock
          label="Title"
          className="sm:col-span-2"
          action={
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => copy(clipTitle, "Title", "title")}
              aria-label="Copy title"
              title="Copy title"
              className="cursor-pointer text-muted-foreground hover:text-foreground"
            >
              {copiedField === "title" ? (
                <CheckIcon className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <CopyIcon className="h-3.5 w-3.5" />
              )}
            </Button>
          }
        >
          <p className="select-text text-base font-semibold leading-6 text-foreground">
            {clipTitle}
          </p>
        </ContentBlock>
        <ContentBlock
          label="Description"
          className="sm:row-span-2"
          action={
            <FieldCopyButton
              label="description"
              copied={copiedField === "description"}
              onClick={() =>
                copy(descriptionText, "Description", "description")
              }
            />
          }
        >
          <p className="select-text text-sm leading-6 text-muted-foreground">
            {descriptionText}
          </p>
        </ContentBlock>
        <ContentBlock
          label="SEO keywords"
          action={
            <FieldCopyButton
              label="SEO keywords"
              copied={copiedField === "keywords"}
              onClick={() =>
                copy(keywords.join(", "), "SEO keywords", "keywords")
              }
            />
          }
        >
          <div className="flex flex-wrap gap-1.5">
            {keywords.map((keyword) => (
              <span
                key={keyword}
                className="rounded-md border border-border/70 bg-muted/40 px-2 py-1 text-xs text-muted-foreground"
              >
                {keyword}
              </span>
            ))}
          </div>
        </ContentBlock>
        <ContentBlock
          label="Hashtags"
          action={
            <FieldCopyButton
              label="hashtags"
              copied={copiedField === "hashtags"}
              onClick={() => copy(hashtags.join(" "), "Hashtags", "hashtags")}
            />
          }
        >
          <div className="flex flex-wrap gap-x-2 gap-y-1">
            {hashtags.map((hashtag) => (
              <span
                key={hashtag}
                className="select-text text-sm font-medium text-primary"
              >
                {hashtag}
              </span>
            ))}
          </div>
        </ContentBlock>
      </div>
    </section>
  );
}

function FieldCopyButton({
  label,
  copied,
  onClick,
}: {
  label: string;
  copied: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      onClick={onClick}
      aria-label={`Copy ${label}`}
      title={`Copy ${label}`}
      className="cursor-pointer text-muted-foreground hover:text-foreground"
    >
      {copied ? (
        <CheckIcon className="h-3.5 w-3.5 text-emerald-500" />
      ) : (
        <CopyIcon className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}

function ContentBlock({
  label,
  action,
  className,
  children,
}: {
  label: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn("min-w-0 space-y-2.5 bg-card px-5 py-4 sm:px-6", className)}
    >
      <div className="flex items-center justify-between gap-3">
        <span className={CARD_LABEL_CLASS}>{label}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

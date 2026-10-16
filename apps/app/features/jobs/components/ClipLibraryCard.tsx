"use client";
import { useState, type ReactNode } from "react";
import { AppCard, type ViewMode } from "@blynta/ui";
import { cn } from "@/lib/utils";
import { FilmIcon, PlayIcon } from "@/features/dashboard/icons";

export function ClipLibraryThumbnail({
  viewMode,
  thumbnail,
  title,
  duration,
  platform,
  platformIcon,
  hoverLabel,
  progress,
}: {
  viewMode: ViewMode;
  thumbnail?: string | null;
  title: string;
  duration: string;
  platform?: string;
  platformIcon?: ReactNode;
  hoverLabel: string;
  progress?: number;
}) {
  const [failed, setFailed] = useState(false);
  const list = viewMode === "list";
  return (
    <div
      className={
        list
          ? "relative h-16 w-28 sm:h-20 sm:w-36 rounded-md bg-muted/40 overflow-hidden shrink-0 border border-border/60"
          : "relative aspect-video w-full bg-muted/40 overflow-hidden select-none"
      }
    >
      {thumbnail && !failed ? (
        // Existing My Clips source thumbnails remain unoptimized and lazy loaded.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnail}
          alt={title}
          onError={() => setFailed(true)}
          className={`h-full w-full object-cover transition-transform ${list ? "duration-300" : "duration-500"} group-hover:scale-105`}
          loading="lazy"
        />
      ) : list ? (
        <div className="h-full w-full flex items-center justify-center bg-muted/20 text-muted-foreground">
          <FilmIcon className="h-5 w-5" />
        </div>
      ) : (
        <div className="h-full w-full flex flex-col items-center justify-center bg-gradient-to-br from-card via-muted/30 to-background">
          <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center text-primary mb-1">
            <FilmIcon className="h-5 w-5" />
          </div>
          <span className="text-[11px] font-medium text-muted-foreground">
            No preview
          </span>
        </div>
      )}
      <div
        className={
          list
            ? "absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none"
            : "absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none"
        }
      />
      {platform && (
        <div
          className={
            list
              ? "absolute top-1 left-1 flex items-center px-1.5 py-0.5 rounded bg-black/70 text-white text-[9px] font-semibold uppercase"
              : "absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-white/10 text-white shadow-xs"
          }
        >
          {!list && platformIcon}
          <span
            className={
              list
                ? undefined
                : "text-[10px] font-semibold tracking-wide uppercase"
            }
          >
            {platform}
          </span>
        </div>
      )}
      <div
        className={
          list
            ? "absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono font-medium text-white"
            : "absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-[11px] font-mono font-medium text-white/90 border border-white/10"
        }
      >
        {duration}
      </div>
      {!list && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/30 backdrop-blur-[2px]">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold shadow-md transform scale-95 group-hover:scale-100 transition-transform">
            <PlayIcon className="h-3.5 w-3.5 ml-0.5" />
            <span>{hoverLabel}</span>
          </div>
        </div>
      )}
      {progress !== undefined && !list && (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-chart-4/30 overflow-hidden">
          <div
            className="h-full bg-chart-4 transition-all duration-300"
            style={{ width: `${Math.max(progress || 15, 10)}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function ClipLibraryCard({
  viewMode,
  thumbnail,
  title,
  metadata,
  status,
  actions,
  onClick,
  className,
}: {
  viewMode: ViewMode;
  thumbnail: ReactNode;
  title: ReactNode;
  metadata: ReactNode;
  status?: ReactNode;
  actions: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  if (viewMode === "list")
    return (
      <AppCard
        onClick={onClick}
        className={cn(
          "group relative flex flex-col sm:flex-row sm:items-center justify-between hover:border-primary/40 hover:shadow-sm transition-all duration-200 cursor-pointer gap-4 text-left rounded-lg",
          className,
        )}
        useDefaultClasses
        contentClassName="flex-col gap-4 sm:flex-row sm:items-center"
      >
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          {thumbnail}
          <div className="min-w-0 flex-1 space-y-1">
            <h4 className="text-sm font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
              {title}
            </h4>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              {metadata}
            </div>
            {status && (
              <div className="pt-0.5 flex items-center gap-2">{status}</div>
            )}
          </div>
        </div>
        <div
          className="relative z-10 flex items-center gap-2 shrink-0 self-end sm:self-center"
          onClick={(event) => event.stopPropagation()}
        >
          {actions}
        </div>
      </AppCard>
    );
  return (
    <AppCard
      onClick={onClick}
      className={cn(
        "group relative flex flex-col overflow-hidden transition-all duration-50 p-0! px-0!",
        "hover:border-primary/40 hover:shadow-sm hover:-translate-y-0.5 cursor-pointer text-left",
        className,
      )}
      contentClassName="p-0!"
      useDefaultClasses={false}
    >
      {thumbnail}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div>
          <h4 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
            {title}
          </h4>
          <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-2">
            {metadata}
          </p>
        </div>
        <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-2">
          {status || <span />}
          <div
            className="relative z-10"
            onClick={(event) => event.stopPropagation()}
          >
            {actions}
          </div>
        </div>
      </div>
    </AppCard>
  );
}

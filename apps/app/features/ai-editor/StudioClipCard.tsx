"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Clapperboard, MoreVertical } from "lucide-react";
import { AppButton, AppCard, AppDropdown, type ViewMode } from "@blynta/ui";
import { Badge } from "@/components/ui/badge";
import { editTime } from "./presentation";
import type { StudioProject } from "./contracts";

export function projectStatus(project: StudioProject) {
  const current =
    project.latestPreview?.revision === project.revision
      ? project.latestPreview
      : null;
  if (current?.status === "completed") return "Preview ready";
  if (current?.status === "queued" || current?.status === "processing")
    return "Rendering";
  if (current?.status === "failed") return "Render failed";
  return project.revision > 1 ? "Changes pending" : "Ready to edit";
}

export function StudioClipCard({
  href,
  sourceHref,
  title,
  thumbnail,
  duration,
  subtitle,
  action,
  status,
  viewMode = "grid",
}: {
  href: string;
  sourceHref: string;
  title: string;
  thumbnail?: string;
  duration: number;
  subtitle: string;
  action: string;
  status: string;
  viewMode?: ViewMode;
}) {
  const router = useRouter();
  const [imageFailed, setImageFailed] = useState(false);
  const list = viewMode === "list";
  const badge = (
    <Badge
      variant={status === "Render failed" ? "destructive" : "secondary"}
      className={`text-[11px] font-semibold ${status === "Render failed" ? "border-destructive/50 bg-destructive/10 text-foreground" : "border-primary/20 bg-primary/10 text-primary"}`}
    >
      {status}
    </Badge>
  );
  const menu = (
    <AppDropdown
      trigger={
        <AppButton
          variant="ghost"
          size="icon-sm"
          aria-label={`Actions for ${title}`}
          className="relative z-10"
        >
          <MoreVertical className="size-4" />
        </AppButton>
      }
      items={[
        { label: action, onClick: () => router.push(href) },
        { label: "View original clip", onClick: () => router.push(sourceHref) },
      ]}
    />
  );
  const thumbnailContent = (
    <div
      className={`relative shrink-0 overflow-hidden bg-muted/40 ${list ? "h-16 w-28 rounded-md border border-border/60 sm:h-20 sm:w-36" : "aspect-video w-full"}`}
    >
      {thumbnail && !imageFailed ? (
        // Match SourceVideoCard's source thumbnail and image fallback.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnail}
          alt=""
          loading="lazy"
          onError={() => setImageFailed(true)}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          <Clapperboard className="size-6" />
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
      <span
        className={`absolute rounded bg-black/75 font-mono font-medium text-white ${list ? "bottom-1 right-1 px-1.5 py-0.5 text-[10px]" : "bottom-2.5 right-2.5 border border-white/10 px-2 py-0.5 text-[11px]"}`}
      >
        {editTime(duration)}
      </span>
    </div>
  );
  const titleContent = (
    <h3
      className={`${list ? "truncate" : "line-clamp-2 leading-snug"} text-sm font-semibold group-hover:text-primary`}
    >
      <Link
        href={href}
        className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring"
        aria-label={`${action}: ${title}`}
      >
        {title}
      </Link>
    </h3>
  );
  return (
    <AppCard
      useDefaultClasses={false}
      className={`group relative overflow-hidden text-left transition-all duration-200 hover:border-primary/40 hover:shadow-sm ${list ? "" : "p-0 hover:-translate-y-0.5"}`}
      contentClassName={
        list ? "flex flex-col gap-4 p-3 sm:flex-row sm:items-center" : "p-0"
      }
    >
      {list ? (
        <>
          <div className="flex min-w-0 flex-1 items-center gap-3.5">
            {thumbnailContent}
            <div className="min-w-0 flex-1 space-y-1">
              {titleContent}
              <p className="text-[11px] text-muted-foreground">{subtitle}</p>
              <div className="pt-0.5">{badge}</div>
            </div>
          </div>
          <div className="relative z-10 flex shrink-0 items-center gap-2 self-end sm:self-center">
            <AppButton
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={href} />}
              className="h-8 text-xs font-semibold"
              icon={<ArrowRight className="size-3.5" />}
              iconPosition="right"
            >
              {action}
            </AppButton>
            {menu}
          </div>
        </>
      ) : (
        <>
          {thumbnailContent}
          <div className="space-y-3 p-4">
            <div>
              {titleContent}
              <p className="mt-1 text-[11px] text-muted-foreground">
                {subtitle}
              </p>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-2">
              {badge}
              {menu}
            </div>
          </div>
        </>
      )}
    </AppCard>
  );
}

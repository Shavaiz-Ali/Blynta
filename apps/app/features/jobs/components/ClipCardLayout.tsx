import type { ComponentProps, ReactNode } from "react";
import { AppCardRoot } from "@blynta/ui";
import { Film } from "lucide-react";
import type { Clip, Highlight, Job } from "../types";

// Share the card composition, but keep height intrinsic to each card. Disclosures
// must never resize neighboring cards through shared grid tracks.
export function ClipCardLayout({
  index,
  status,
  media,
  children,
  footer,
  className = "",
  ...props
}: {
  index: number;
  status: ReactNode;
  media: ReactNode;
  children: ReactNode;
  footer: ReactNode;
} & ComponentProps<"div">) {
  return (
    <AppCardRoot
      {...props}
      className={`min-w-0 self-start flex flex-col gap-0 rounded-xl border-border/70 bg-card/70 p-0 shadow-xs ${className}`}
    >
      <div
        data-clip-section="header"
        className="flex items-center justify-between gap-3 px-4 py-3 text-[10px] font-medium"
      >
        <span className="uppercase tracking-wider text-muted-foreground">
          Clip {String(index + 1).padStart(2, "0")}
        </span>
        {status}
      </div>
      <div
        data-clip-section="media"
        className="relative aspect-[16/10] w-full overflow-hidden bg-muted/40 select-none"
      >
        {media}
      </div>
      <div data-clip-section="content" className="min-w-0 space-y-1.5 p-4">
        {children}
      </div>
      <div
        data-clip-section="footer"
        className="min-w-0 border-t border-border/60 px-4 py-3"
      >
        {footer}
      </div>
    </AppCardRoot>
  );
}

export function ClipCardTitle({ children }: { children: string }) {
  return (
    <h4
      className="line-clamp-1 break-words text-base font-semibold leading-snug text-foreground"
      title={children}
    >
      {children}
    </h4>
  );
}

export function ClipPendingMedia({
  job,
  clip,
  highlight,
  label,
  icon,
}: {
  job: Job;
  clip?: Clip;
  highlight?: Highlight;
  label: string;
  icon: ReactNode;
}) {
  const start = clip?.startTime ?? highlight?.startTime;
  const end = clip?.endTime ?? highlight?.endTime;
  return (
    <>
      {job.thumbnailUrl ? (
        <img
          src={job.thumbnailUrl}
          alt=""
          className="h-full w-full object-cover opacity-25 saturate-50"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-muted/30 via-card to-background" />
      )}
      <div className="absolute inset-0 bg-background/35" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-border/80 bg-card/80 text-muted-foreground">
          {icon || <Film className="h-5 w-5" />}
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
      </div>
      {start !== undefined && end !== undefined && (
        <div className="absolute inset-x-3 bottom-2.5 flex justify-between gap-2 text-[10px] tabular-nums text-muted-foreground">
          <span>
            {clipTime(start)} → {clipTime(end)}
          </span>
          <span>{clipTime(Math.max(0, end - start))}</span>
        </div>
      )}
    </>
  );
}

function clipTime(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  return `${Math.floor(value / 60)
    .toString()
    .padStart(2, "0")}:${(value % 60).toString().padStart(2, "0")}`;
}

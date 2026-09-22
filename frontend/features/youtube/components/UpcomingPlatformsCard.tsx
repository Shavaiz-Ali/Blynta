"use client";

import * as React from "react";
import { AppCard } from "@/components/common/AppCard";

function TikTokIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.86 4.86 0 01-1.01-.07z" />
    </svg>
  );
}

function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

interface UpcomingPlatformProps {
  name: string;
  category: string;
  description: string;
  icon: React.ReactNode;
  tags: string[];
}

function UpcomingPlatformCard({
  name,
  category,
  description,
  icon,
  tags,
}: UpcomingPlatformProps) {
  return (
    <AppCard
      className="rounded-lg border-border/60 bg-card hover:border-border/90 transition-all"
      useDefaultClasses={false}
      contentClassName="p-4 space-y-3 flex flex-col w-full"
    >
      <div className="flex items-center justify-between gap-3 w-full">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-muted/60 border border-border/50 flex items-center justify-center shrink-0 text-foreground">
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-bold text-foreground">{name}</h3>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80 bg-muted rounded px-1.5 py-0.5">
                Coming Soon
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">{category}</p>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed w-full">
        {description}
      </p>

      {/* Feature tags */}
      <div className="flex items-center gap-1.5 flex-wrap pt-0.5 w-full">
        {tags.map((t) => (
          <span
            key={t}
            className="text-[10px] font-medium text-muted-foreground/80 bg-muted/40 border border-border/40 rounded px-1.5 py-0.5"
          >
            {t}
          </span>
        ))}
      </div>
    </AppCard>
  );
}

export function UpcomingPlatformsSection() {
  return (
    <div className="space-y-3 w-full">
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          More Platforms
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Upcoming publishing destinations for your generated clips.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 w-full">
        <UpcomingPlatformCard
          name="TikTok"
          category="Short-form video publishing"
          description="Publish clips directly to your TikTok account with trending sound integration and scheduled posting."
          icon={<TikTokIcon className="h-4.5 w-4.5" />}
          tags={["Vertical Video", "Scheduled Posts", "Auto-Hashtags"]}
        />

        <UpcomingPlatformCard
          name="Instagram"
          category="Reels &amp; Stories publishing"
          description="Share high-engagement Reels straight to your creator or business profile with custom thumbnails."
          icon={<InstagramIcon className="h-4.5 w-4.5 text-[#E1306C]" />}
          tags={["Instagram Reels", "Cover Selector", "Auto-Captions"]}
        />
      </div>
    </div>
  );
}

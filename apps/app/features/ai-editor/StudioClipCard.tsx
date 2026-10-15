"use client";
import Link from "next/link";
import Image from "next/image";
import { Clapperboard } from "lucide-react";
import { editTime } from "./presentation";
export function StudioClipCard({
  href,
  title,
  thumbnail,
  duration,
  subtitle,
  action,
}: {
  href: string;
  title: string;
  thumbnail?: string;
  duration: number;
  subtitle?: string;
  action: string;
}) {
  return (
    <Link
      href={href}
      aria-label={`${action}: ${title}`}
      className="group block min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
    >
      <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-muted transition-opacity group-hover:opacity-90">
        {thumbnail ? (
          <Image
            unoptimized
            src={thumbnail}
            alt=""
            fill
            className="object-cover"
          />
        ) : (
          <Clapperboard className="size-8 text-muted-foreground/50" />
        )}
        <span className="absolute bottom-2 right-2 rounded bg-black/75 px-2 py-1 text-xs text-white">
          {editTime(duration)}
        </span>
      </div>
      <div className="space-y-1.5 px-0.5 pt-3">
        <h3 className="truncate text-sm font-semibold" title={title}>
          {title}
        </h3>
        {subtitle && (
          <p
            className="truncate text-xs text-muted-foreground"
            title={subtitle}
          >
            {subtitle}
          </p>
        )}
      </div>
    </Link>
  );
}

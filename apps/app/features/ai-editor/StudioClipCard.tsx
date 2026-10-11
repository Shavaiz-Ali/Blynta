"use client";
import Link from "next/link";
import Image from "next/image";
import { Clapperboard, ArrowUpRight } from "lucide-react";
import { AppButton, AppCardRoot } from "@blynta/ui";
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
    <AppCardRoot className="group min-w-0 gap-0 overflow-hidden p-0 transition-colors hover:border-primary/50">
      <Link
        href={href}
        aria-label={`${action}: ${title}`}
        className="relative flex aspect-video items-center justify-center overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      >
        {thumbnail ? (
          <Image
            unoptimized
            src={thumbnail}
            alt=""
            fill
            className="object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <Clapperboard className="size-8 text-muted-foreground/50" />
        )}
        <span className="absolute bottom-2 right-2 rounded bg-black/75 px-2 py-1 text-xs text-white">
          {editTime(duration)}
        </span>
      </Link>
      <div className="space-y-2 p-4">
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
        <AppButton
          variant="secondary"
          size="sm"
          className="mt-1 w-full"
          nativeButton={false}
          role="link"
          render={<Link href={href} />}
        >
          {action}
          <ArrowUpRight className="size-3.5" />
        </AppButton>
      </div>
    </AppCardRoot>
  );
}

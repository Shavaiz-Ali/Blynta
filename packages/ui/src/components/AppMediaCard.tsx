"use client";
import { AppCard, type AppCardProps } from "./AppCard";
import { cn } from "../lib/utils";
/** Shared thumbnail-card surface used by Blynta and Studio. */
export function AppMediaCard({
  className,
  contentClassName,
  ...props
}: AppCardProps) {
  return (
    <AppCard
      {...props}
      useDefaultClasses={false}
      contentClassName={cn("p-0", contentClassName)}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl p-0 text-left transition-[border-color,box-shadow,background-color] duration-200 hover:border-primary/35 hover:bg-card/90 hover:shadow-md hover:shadow-black/10",
        className,
      )}
    />
  );
}

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface BlyntaLogoProps {
  variant?: "full" | "icon";
  size?: "sm" | "md" | "lg" | number;
  className?: string;
  iconOnly?: boolean;
  badge?: string;
}

export function BlyntaLogo({
  variant = "full",
  size = "md",
  className,
  iconOnly = false,
  badge,
}: BlyntaLogoProps) {
  const isIconOnly = iconOnly || variant === "icon";

  const getIconSize = () => {
    if (typeof size === "number") return size;
    switch (size) {
      case "sm":
        return 24;
      case "lg":
        return 44;
      case "md":
      default:
        return 32;
    }
  };

  const iconPx = getIconSize();

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2.5 select-none focus:outline-none",
        className,
      )}
    >
      <div
        className="relative flex items-center justify-center shrink-0"
        style={{ width: iconPx, height: iconPx }}
      >
        <svg
          width={iconPx}
          height={iconPx}
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-sm transition-transform hover:scale-105 duration-200"
        >
          <defs>
            <linearGradient
              id="blynta-admin-logo-primary-grad"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="var(--primary)" />
              <stop offset="100%" stopColor="var(--chart-4)" />
            </linearGradient>

            <filter
              id="blynta-admin-logo-glow"
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
            >
              <feDropShadow
                dx="0"
                dy="2"
                stdDeviation="3"
                floodColor="var(--primary)"
                floodOpacity="0.3"
              />
            </filter>
          </defs>

          {/* Background Rounded Frame */}
          <rect
            x="2"
            y="2"
            width="36"
            height="36"
            rx="10"
            fill="var(--card)"
            stroke="var(--border)"
            strokeWidth="1.5"
          />

          {/* Ambient Mesh */}
          <rect
            x="4"
            y="4"
            width="32"
            height="32"
            rx="8"
            fill="url(#blynta-admin-logo-primary-grad)"
            opacity="0.15"
          />

          {/* Forward Play Triangle Mark */}
          <path
            d="M12 11C12 9.8 13.3 9.1 14.3 9.7L25.3 16.7C26.2 17.3 26.2 18.7 25.3 19.3L14.3 26.3C13.3 26.9 12 26.2 12 25V11Z"
            fill="url(#blynta-admin-logo-primary-grad)"
            filter="url(#blynta-admin-logo-glow)"
          />

          {/* Star Cutouts */}
          <path
            d="M26 9L27.4 13.6L32 15L27.4 16.4L26 21L24.6 16.4L20 15L24.6 13.6L26 9Z"
            fill="var(--secondary)"
          />
          <path
            d="M14 26L14.8 28.2L17 29L14.8 29.8L14 32L13.2 29.8L11 29L13.2 28.2L14 26Z"
            fill="var(--secondary)"
            opacity="0.85"
          />
        </svg>
      </div>

      {!isIconOnly && (
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={cn(
              "font-sans font-extrabold tracking-tight text-foreground flex items-baseline leading-none",
              size === "sm" && "text-base",
              size === "md" && "text-xl",
              size === "lg" && "text-2xl",
            )}
          >
            Blynta
            <span className="text-primary font-serif font-normal ml-0.5 animate-pulse">
              .
            </span>
          </span>
          {badge && (
            <span className="rounded-md border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary leading-none">
              {badge}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

import React from "react";
import Link from "next/link";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function Logo({ className = "", size = "md" }: LogoProps) {
  const iconSize = size === "sm" ? 24 : size === "lg" ? 36 : 30;

  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-2.5 font-bold tracking-tight text-foreground transition-opacity hover:opacity-90 ${className}`}
      aria-label="Blynta home"
    >
      <div className="relative flex items-center justify-center rounded-xl bg-primary/10 border border-primary/25 p-1.5 shadow-sm text-primary">
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="shrink-0"
        >
          <defs>
            <linearGradient id="blynta-logo-g1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--primary)" />
              <stop offset="100%" stopColor="#818cf8" />
            </linearGradient>
          </defs>
          <path
            d="M10 9C10 7.9 11.2 7.2 12.1 7.8L21.9 13.8C22.7 14.3 22.7 15.7 21.9 16.2L12.1 22.2C11.2 22.8 10 22.1 10 21V9Z"
            fill="url(#blynta-logo-g1)"
          />
          <path
            d="M21 7L21.9 9.6L24.5 10.5L21.9 11.4L21 14L20.1 11.4L17.5 10.5L20.1 9.6L21 7Z"
            fill="var(--primary)"
            opacity="0.9"
          />
          <path
            d="M11 20L11.6 21.7L13.3 22.3L11.6 22.9L11 24.6L10.4 22.9L8.7 22.3L10.4 21.7L11 20Z"
            fill="var(--primary)"
            opacity="0.75"
          />
        </svg>
      </div>
      <span className="text-xl font-extrabold tracking-tight">
        Blynta
        <span className="text-primary font-serif animate-pulse-subtle inline-block ml-0.5">
          .
        </span>
      </span>
    </Link>
  );
}


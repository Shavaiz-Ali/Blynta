"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { signOut } from "next-auth/react";
import type { UserProfile } from "@/features/auth/types";
import { Separator } from "@/components/ui/separator";

export function UserDropdown({ profile }: { profile: UserProfile }) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const initials = (profile.name || profile.email || "?")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Close dropdown on outside click or Escape key
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2.5 rounded-xl p-1 px-2 hover:bg-muted/60 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <div className="hidden sm:flex flex-col items-end leading-tight text-right">
          <span className="text-xs font-semibold text-foreground">
            {profile.name || profile.email}
          </span>
          <span className="text-[11px] capitalize text-muted-foreground">
            {profile.plan} plan
          </span>
        </div>
        <div className="h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br from-primary to-chart-4 text-primary-foreground flex items-center justify-center text-sm font-bold shadow-sm">
          {initials}
        </div>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-56 origin-top-right rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg ring-1 ring-border z-50 animate-in fade-in-0 zoom-in-95"
          role="menu"
          aria-orientation="vertical"
        >
          {/* Header row */}
          <div className="px-3 py-2.5">
            <p className="text-xs font-semibold text-foreground truncate">
              {profile.name || "User Account"}
            </p>
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
              {profile.email}
            </p>
          </div>

          <Separator className="my-1" />

          {/* Links */}
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex w-full items-center px-3 py-2 text-xs font-medium rounded-xl hover:bg-accent hover:text-accent-foreground transition-colors"
            role="menuitem"
          >
            Profile
          </Link>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex w-full items-center px-3 py-2 text-xs font-medium rounded-xl hover:bg-accent hover:text-accent-foreground transition-colors"
            role="menuitem"
          >
            Settings
          </Link>
          <Link
            href="/billing"
            onClick={() => setOpen(false)}
            className="flex w-full items-center px-3 py-2 text-xs font-medium rounded-xl hover:bg-accent hover:text-accent-foreground transition-colors"
            role="menuitem"
          >
            Billing &amp; Plan
          </Link>

          <Separator className="my-1" />

          {/* Log out */}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              toast.info("Logged out of session.");
              signOut({ callbackUrl: "/login" });
            }}
            className="flex w-full items-center px-3 py-2 text-xs font-medium rounded-xl text-destructive hover:bg-destructive/10 transition-colors text-left cursor-pointer"
            role="menuitem"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

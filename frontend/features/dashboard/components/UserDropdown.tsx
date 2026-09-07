import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import type { UserProfile } from "@/features/auth/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SunIcon, MoonIcon, CheckIcon } from "../icons";
import { cn } from "@/lib/utils";

function getInitials(name?: string | null, email?: string | null): string {
  const source = name || email || "?";
  return source
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function UserDropdown({ profile }: { profile: UserProfile }) {
  const initials = getInitials(profile.name, profile.email);
  const planLabel = profile.plan ?? "free";
  const isPro = planLabel === "pro" || planLabel === "business";
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2.5 rounded-lg p-1 pr-2 hover:bg-muted/60 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40 cursor-pointer"
        aria-label="User menu"
      >
        <div className="hidden sm:flex flex-col items-end leading-tight text-right">
          <span className="text-xs font-semibold text-foreground">
            {profile.name || profile.email}
          </span>
          <span className="text-[11px] capitalize text-muted-foreground">
            {planLabel} plan
          </span>
        </div>
        <Avatar className="h-8 w-8 rounded-lg">
          <AvatarFallback className="rounded-lg bg-primary/15 text-primary text-xs font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-56 rounded-xl p-1.5"
      >
        {/* Header */}
        <div className="px-2.5 py-2">
          <p className="text-xs font-semibold text-foreground truncate">
            {profile.name || "User Account"}
          </p>
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
            {profile.email}
          </p>
          <Badge
            variant="secondary"
            className={cn(
              "mt-1.5 text-[10px] h-5 px-1.5 font-bold uppercase tracking-wider",
              isPro && "bg-primary/15 text-primary border-primary/25"
            )}
          >
            {planLabel}
          </Badge>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem render={<Link href="/settings" />} className="rounded-lg text-xs cursor-pointer">
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/settings" />} className="rounded-lg text-xs cursor-pointer">
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/billing" />} className="rounded-lg text-xs cursor-pointer">
          Billing &amp; Plan
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Appearance / Theme Submenu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="rounded-lg text-xs cursor-pointer">
            <span className="flex items-center gap-2">
              <SunIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Appearance</span>
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-36 rounded-xl p-1">
            <DropdownMenuItem
              className="rounded-lg text-xs cursor-pointer flex items-center justify-between"
              onClick={() => setTheme("light")}
            >
              <span>Light</span>
              {theme === "light" && <CheckIcon className="h-3.5 w-3.5 text-primary" />}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="rounded-lg text-xs cursor-pointer flex items-center justify-between"
              onClick={() => setTheme("dark")}
            >
              <span>Dark</span>
              {theme === "dark" && <CheckIcon className="h-3.5 w-3.5 text-primary" />}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="rounded-lg text-xs cursor-pointer flex items-center justify-between"
              onClick={() => setTheme("system")}
            >
              <span>System</span>
              {theme === "system" && <CheckIcon className="h-3.5 w-3.5 text-primary" />}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="rounded-lg text-xs text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
          onClick={() => {
            toast.info("Logged out of session.");
            signOut({ callbackUrl: "/login" });
          }}
        >
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

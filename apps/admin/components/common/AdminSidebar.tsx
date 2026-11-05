"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { navigation } from "@/lib/navigation";
import { can } from "@/lib/permissions";
import { BlyntaLogo } from "../logo";
import { AppSidebar, AppSidebarItem } from "@blynta/ui";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

function getInitials(name?: string | null, email?: string | null): string {
  const source = name?.trim() || email?.split("@")[0] || "Admin";
  return source
    .split(/[\s._-]+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export interface AdminSidebarContentProps {
  isCollapsed: boolean;
  onNavigate?: () => void;
}

export function AdminSidebarContent({
  isCollapsed,
  onNavigate,
}: AdminSidebarContentProps) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const initials = getInitials(session?.user?.name, session?.user?.email);

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto overflow-x-hidden">
      {/* ── Logo Lockup ── */}
      <div
        className={cn(
          "flex items-center shrink-0 px-3.5 pt-3.5 pb-1",
          isCollapsed ? "justify-center" : "justify-between",
        )}
      >
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-2.5 min-w-0"
        >
          <BlyntaLogo
            variant={isCollapsed ? "icon" : "full"}
            size="md"
            badge={isCollapsed ? undefined : "Admin"}
          />
        </Link>
      </div>

      <div className="px-2.5 py-0.5">
        <Separator className="bg-border/50" />
      </div>

      {/* ── Grouped Navigation ── */}
      <nav className="flex-1 flex flex-col gap-3 px-2.5">
        {navigation.map((group) => {
          const items = group.items.filter((item) =>
            can(session?.user?.role, item.permission),
          );
          if (!items.length) return null;

          return (
            <div key={group.label} className="flex flex-col gap-1.5">
              {!isCollapsed && (
                <p className="px-3 pt-2 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                  {group.label}
                </p>
              )}
              {items.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <AppSidebarItem
                    key={item.href}
                    label={item.title}
                    icon={<Icon className="size-4" />}
                    active={active}
                    collapsed={isCollapsed}
                    href={item.href}
                    onClick={onNavigate}
                    renderLink={(props) => (
                      <Link href={item.href} {...props} />
                    )}
                  />
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* ── Sidebar Footer: Admin Profile ── */}
      <div
        className={cn(
          "shrink-0 mt-auto border-t border-border/60",
          isCollapsed ? "p-2" : "p-3 space-y-2.5",
        )}
      >
        {!isCollapsed ? (
          <div className="flex items-center gap-2.5 px-0.5">
            <Avatar className="h-8 w-8 rounded-lg shrink-0 border border-border/80 bg-muted">
              <AvatarFallback className="rounded-lg bg-primary/15 text-primary text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground truncate leading-tight">
                {session?.user?.name || "Administrator"}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {session?.user?.email || "admin@blynta.com"}
              </p>
            </div>
          </div>
        ) : (
          <Tooltip>
            <TooltipTrigger
              render={
                <div className="flex justify-center w-full py-1">
                  <Avatar className="h-8 w-8 rounded-lg border border-border/80 bg-muted">
                    <AvatarFallback className="rounded-lg bg-primary/15 text-primary text-xs font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </div>
              }
            />
            <TooltipContent side="right" className="text-xs">
              {session?.user?.name || "Administrator"}
              <br />
              <span className="text-muted-foreground">
                {session?.user?.email}
              </span>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

export function AdminSidebar({
  collapsed,
  className,
}: {
  collapsed?: boolean;
  className?: string;
}) {
  return (
    <AppSidebar
      id="admin-sidebar"
      collapsed={collapsed}
      className={cn("h-full", className)}
    >
      <AdminSidebarContent isCollapsed={Boolean(collapsed)} />
    </AppSidebar>
  );
}

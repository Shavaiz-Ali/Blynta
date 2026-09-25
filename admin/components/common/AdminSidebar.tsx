"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { AppButton } from "./AppButton";
import { BlyntaLogo } from "@/components/logo";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Video,
  ShieldAlert,
  LogOut,
  Menu,
  X,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Users", href: "/users", icon: Users },
  { label: "Billing & Plans", href: "/billing", icon: CreditCard },
  { label: "Jobs Pipeline", href: "/jobs", icon: Video },
  { label: "Audit Log", href: "/audit", icon: ShieldAlert },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile top navigation bar */}
      <div className="md:hidden flex items-center justify-between border-b border-border bg-card px-4 py-3 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <BlyntaLogo size="sm" />
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary border border-primary/20">
            Admin
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <AppButton
            variant="ghost"
            size="icon-sm"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </AppButton>
        </div>
      </div>

      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={cn(
          "fixed md:static inset-y-0 left-0 z-50 flex flex-col justify-between w-64 border-r border-border bg-sidebar text-sidebar-foreground transition-transform duration-200 ease-in-out md:translate-x-0 h-screen shrink-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand header */}
        <div className="p-5 border-b border-sidebar-border flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <BlyntaLogo size="sm" />
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary border border-primary/20">
              Admin
            </span>
          </Link>
          <ThemeToggle />
        </div>

        {/* Navigation list */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {ADMIN_NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0 transition-colors",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer with logged in admin and sign out */}
        <div className="p-3.5 border-t border-sidebar-border bg-card/30">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="size-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center border border-primary/20 shrink-0">
                {session?.user?.email ? session.user.email[0].toUpperCase() : "A"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold truncate text-foreground">
                  {session?.user?.name || session?.user?.email?.split("@")[0] || "Admin"}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {session?.user?.email || "admin@blynta.com"}
                </div>
              </div>
            </div>

            <AppButton
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
              title="Sign Out"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="size-4" />
            </AppButton>
          </div>
        </div>
      </aside>
    </>
  );
}

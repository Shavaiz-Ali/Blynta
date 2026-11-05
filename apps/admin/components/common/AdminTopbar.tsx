"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Bell } from "lucide-react";
import { AppProductHeader, AppAccountMenu, AppButton } from "@blynta/ui";
import { ThemeToggle } from "./ThemeToggle";
import { navigation } from "@/lib/navigation";

export interface AdminTopbarProps {
  collapsed: boolean;
  onCollapse: () => void;
  onMenu: () => void;
}

export function AdminTopbar({
  collapsed,
  onCollapse,
  onMenu,
}: AdminTopbarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const page = navigation
    .flatMap((group) => group.items)
    .find(
      (item) =>
        item.href === pathname ||
        (item.href !== "/" && pathname.startsWith(item.href)),
    );

  const aiSection = /^\/ai\/(providers|models|usage)(?:\/|$)/.exec(
    pathname,
  )?.[1];

  return (
    <AppProductHeader
      collapsed={collapsed}
      onCollapse={onCollapse}
      onMenu={onMenu}
      sidebarId="admin-sidebar"
    >
      <div className="flex w-full min-w-0 items-center justify-between gap-4">
        {/* Left: Breadcrumb / Page Title */}
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 text-xs text-muted-foreground min-w-0"
        >
          <Link
            href="/"
            className="hover:text-foreground font-medium transition-colors"
          >
            Admin
          </Link>
          <span aria-hidden="true" className="text-muted-foreground/40">
            /
          </span>
          <span className="font-semibold text-foreground truncate">
            {page?.title || "Overview"}
          </span>
          {aiSection && (
            <>
              <span aria-hidden="true" className="text-muted-foreground/40">
                /
              </span>
              <span className="capitalize text-foreground font-medium">
                {aiSection}
              </span>
            </>
          )}
        </nav>

        {/* Right Actions */}
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <AppButton
            variant="ghost"
            size="icon-sm"
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60"
            aria-label="Notifications"
            render={<Link href="/notifications" />}
          >
            <Bell className="size-4" />
          </AppButton>

          <ThemeToggle />

          <AppAccountMenu
            profile={{
              name: session?.user?.name || "Administrator",
              email: session?.user?.email || "admin@blynta.com",
              plan: "Admin",
            }}
            links={[
              { label: "Overview", render: <Link href="/" /> },
              { label: "Settings", render: <Link href="/settings" /> },
              { label: "Audit Logs", render: <Link href="/audit" /> },
            ]}
            onSignOut={async (onSuccess) => {
              await onSuccess();
              await signOut({ callbackUrl: "/login" });
            }}
          />
        </div>
      </div>
    </AppProductHeader>
  );
}

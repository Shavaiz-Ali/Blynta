"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Bell, LogOut, UserRound } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { AppButton, AppLinkButton } from "./AppButton";
import { navigation } from "@/lib/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

export function AdminTopbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const page = navigation.flatMap((group) => group.items).find((item) => item.href === pathname);

  return (
    <header className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-background px-4 py-3 sm:px-6">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="h-4" />
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">Admin</Link>
          <span aria-hidden="true">/</span>
          <span className="font-medium text-foreground">{page?.title || "Details"}</span>
        </nav>
      </div>

      <div className="flex items-center gap-1">
        <AppLinkButton
          variant="ghost"
          size="icon-sm"
          render={<Link href="/notifications" />}
          aria-label="Notifications"
        >
          <Bell />
        </AppLinkButton>
        <ThemeToggle />
        <details className="relative">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
            <UserRound className="size-4" />
            <span className="hidden sm:inline">Account</span>
          </summary>
          <div className="absolute right-0 z-30 mt-2 min-w-60 rounded-lg border bg-popover p-3 text-popover-foreground shadow-md">
            <p className="mb-3 break-all text-sm text-muted-foreground">{session?.user.email}</p>
            <AppButton variant="outline" className="w-full justify-start" onClick={() => signOut({ callbackUrl: "/login" })}>
              <LogOut />
              Sign out
            </AppButton>
          </div>
        </details>
      </div>
    </header>
  );
}

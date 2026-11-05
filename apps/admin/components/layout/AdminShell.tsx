"use client";

import * as React from "react";
import { AppSidebar } from "@blynta/ui";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { AdminSidebarContent } from "@/components/common/AdminSidebar";
import { AdminTopbar } from "@/components/common/AdminTopbar";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  return (
    <div className="flex h-dvh min-h-0 bg-background text-foreground overflow-hidden">
      {/* ── Desktop Collapsible Sidebar ── */}
      <AppSidebar id="admin-sidebar" collapsed={isCollapsed} className="h-full">
        <AdminSidebarContent isCollapsed={isCollapsed} />
      </AppSidebar>

      {/* ── Mobile Drawer (Sheet) ── */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-[240px] p-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border"
        >
          <SheetTitle className="sr-only">Admin Navigation</SheetTitle>
          <AdminSidebarContent
            isCollapsed={false}
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* ── Main Content Viewport ── */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
        {/* Topbar */}
        <AdminTopbar
          collapsed={isCollapsed}
          onCollapse={() => setIsCollapsed((prev) => !prev)}
          onMenu={() => setMobileOpen(true)}
        />

        {/* Content area matching apps/app spacing and constraints */}
        <main
          id="main-content"
          className="flex-1 min-h-0 min-w-0 w-full overflow-y-auto"
        >
          <div className="w-full min-w-0 max-w-7xl mx-auto px-4 sm:px-8 py-6 lg:py-8 space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}


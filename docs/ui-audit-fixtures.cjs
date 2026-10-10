// Temporary development routes for visual verification. Never deploy these files.
// Run from the repository root; --clean removes only this script's exact files.
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const views = {
  admin: {
    overview: [
      "@/features/admin-dashboard/components/DashboardView",
      "DashboardView",
    ],
    users: ["@/features/admin-users/components/UsersView", "UsersView"],
    "user-detail": [
      "@/features/admin-users/components/UserDetailPage",
      "UserDetailPage",
      'id="aaaaaaaaaaaaaaaaaaaaaaaa"',
    ],
    jobs: ["@/features/admin-jobs/components/JobsView", "JobsView"],
    "job-detail": [
      "@/features/admin-jobs/components/JobDetailPage",
      "JobDetailPage",
      'id="bbbbbbbbbbbbbbbbbbbbbbbb"',
    ],
    queues: ["@/features/admin-jobs/components/QueuesView", "QueuesView"],
    billing: ["@/features/admin-billing/components/BillingView", "BillingView"],
    analytics: ["@/features/analytics/AnalyticsView", "AnalyticsView"],
    audit: ["@/features/admin-audit/components/AuditView", "AuditView"],
    clips: ["@/features/admin-clips/ClipsView", "ClipsView"],
    system: ["@/features/admin-system/SystemHealthView", "SystemHealthView"],
    notifications: [
      "@/features/admin-system/NotificationsView",
      "NotificationsView",
    ],
    settings: ["@/features/admin-system/SettingsView", "SettingsView"],
    flags: [
      "@/features/admin-system/CapabilityView",
      "CapabilityView",
      'kind="flags" title="Feature flags" description="Platform feature availability."',
    ],
    providers: [
      "@/features/admin-ai/AIManagement",
      "AIManagement",
      'initialSection="providers"',
    ],
    models: [
      "@/features/admin-ai/AIManagement",
      "AIManagement",
      'initialSection="models"',
    ],
    usage: [
      "@/features/admin-ai/AIManagement",
      "AIManagement",
      'initialSection="usage"',
    ],
  },
  app: {
    dashboard: [
      "@/features/dashboard/components/DashboardHome",
      "DashboardHome",
    ],
    clips: ["@/features/jobs/components/ClipsLibrary", "ClipsLibrary"],
    "clip-detail": [
      "@/features/jobs/components/ClipDetailView",
      "ClipDetailView",
      'jobId="bbbbbbbbbbbbbbbbbbbbbbbb" clipId="cccccccccccccccccccccccc"',
    ],
    studio: ["@/features/ai-editor/StudioLanding", "StudioLanding"],
    workspace: [
      "@/features/ai-editor/StudioWorkspace",
      "StudioWorkspace",
      'jobId="bbbbbbbbbbbbbbbbbbbbbbbb" clipId="cccccccccccccccccccccccc"',
    ],
    billing: ["@/features/billing/components/BillingPage", "BillingPage"],
    profile: ["@/features/profile/components/ProfilePage", "ProfilePage"],
    publications: [
      "@/features/youtube/components/PublicationsPage",
      "PublicationsPage",
    ],
  },
};
for (const app of ["admin", "app"]) {
  const dir = path.join(root, "apps", app, "app", "auth", "ui-audit");
  if (!dir.startsWith(root + path.sep)) throw Error("Unsafe fixture path");
  if (process.argv.includes("--clean")) {
    for (const file of ["page.tsx", "Fixture.tsx"])
      if (fs.existsSync(path.join(dir, file)))
        fs.unlinkSync(path.join(dir, file));
    if (fs.existsSync(dir)) fs.rmdirSync(dir);
    continue;
  }
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "page.tsx"),
    `import { Suspense } from "react";import { notFound } from "next/navigation";import Fixture from "./Fixture";
export default function Page(){if(process.env.NODE_ENV !== "development" || process.env.UI_AUDIT_PREVIEW !== "1")notFound();return <Suspense fallback={<p>Loading visual fixture…</p>}><Fixture /></Suspense>;}`,
  );
  const entries = Object.entries(views[app]);
  const imports = entries
    .map(
      ([, [file, name]], i) => `import { ${name} as View${i} } from "${file}";`,
    )
    .join("\n");
  const shell =
    app === "admin"
      ? `import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";import { AdminSidebar } from "@/components/common/AdminSidebar";import { AdminTopbar } from "@/components/common/AdminTopbar";`
      : "";
  const content = `${entries.map(([key, [, , props]], i) => `view === "${key}" ? <View${i} ${props || ""} /> :`).join("\n")} <p>Unknown fixture view.</p>`;
  fs.writeFileSync(
    path.join(dir, "Fixture.tsx"),
    `"use client";
import { useSearchParams } from "next/navigation";import { useQueryClient } from "@tanstack/react-query";
${imports}
${shell}
export default function Fixture(){const client=useQueryClient();client.setDefaultOptions({queries:{retry:false,staleTime:30000}});const view=useSearchParams().get("view")||"${app === "admin" ? "overview" : "workspace"}";const content=(${content});
return ${app === "admin" ? `<SidebarProvider><AdminSidebar /><SidebarInset className="min-h-dvh min-w-0 bg-background md:h-svh"><AdminTopbar /><div id="main-content" className="min-h-0 min-w-0 flex-1 overflow-y-auto"><div className="mx-auto w-full max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6 xl:px-8 xl:py-7">{content}</div></div></SidebarInset></SidebarProvider>` : "content"};}`,
  );
}
console.log(
  process.argv.includes("--clean")
    ? "Temporary visual routes removed."
    : "Temporary routes created at /auth/ui-audit; require UI_AUDIT_PREVIEW=1 and development mode.",
);

// Chrome download requests bypass Playwright interception, so the synthetic file
// also lives temporarily under the existing public auth prefix. No auth rule changes.
const video = path.join(root, "apps/app/public/ui-audit-video.mp4");
const mediaDir = path.join(root, "apps/app/public/auth");
const publicVideo = path.join(mediaDir, "ui-audit-video.mp4");
if (process.argv.includes("--clean")) {
  for (const file of [video, publicVideo])
    if (fs.existsSync(file)) fs.unlinkSync(file);
  if (fs.existsSync(mediaDir) && fs.readdirSync(mediaDir).length === 0)
    fs.rmdirSync(mediaDir);
} else if (fs.existsSync(video)) {
  fs.mkdirSync(mediaDir, { recursive: true });
  fs.copyFileSync(video, publicVideo);
}

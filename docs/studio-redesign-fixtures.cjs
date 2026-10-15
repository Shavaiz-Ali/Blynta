// Development-only fixture for the real Studio components and authenticated shell.
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const dir = path.join(root, "apps/app/app/auth/studio-preview");
const video = path.join(root, "apps/app/public/auth/studio-preview.mp4");
const files = [
  path.join(dir, "page.tsx"),
  path.join(dir, "Fixture.tsx"),
  video,
];
if (process.argv.includes("--clean")) {
  for (const file of files) {
    if (!file.startsWith(root + path.sep)) throw Error("Unsafe fixture path");
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
  if (fs.existsSync(dir) && !fs.readdirSync(dir).length) fs.rmdirSync(dir);
  const validator = path.join(root, "apps/app/.next/dev/types/validator.ts");
  if (
    fs.existsSync(validator) &&
    fs.readFileSync(validator, "utf8").includes("/auth/studio-preview")
  )
    fs.unlinkSync(validator);
  process.exit(0);
}
fs.mkdirSync(dir, { recursive: true });
fs.mkdirSync(path.dirname(video), { recursive: true });
fs.writeFileSync(
  files[0],
  `import { Suspense } from "react"; import { notFound } from "next/navigation"; import Fixture from "./Fixture";
export default function Page(){if(process.env.NODE_ENV !== "development" || process.env.UI_AUDIT_PREVIEW !== "1")notFound();return <Suspense><Fixture /></Suspense>;}`,
);
fs.writeFileSync(
  files[1],
  `"use client";
import { useSearchParams } from "next/navigation"; import { AppShell } from "@/components/layout/AppShell";
import { StudioWorkspace } from "@/features/ai-editor/StudioWorkspace"; import { StudioLanding } from "@/features/ai-editor/StudioLanding";
export default function Fixture(){const listing=useSearchParams().get("view")==="listing"; return <AppShell>{listing ? <StudioLanding /> : <StudioWorkspace jobId="bbbbbbbbbbbbbbbbbbbbbbbb" clipId="cccccccccccccccccccccccc" />}</AppShell>;}`,
);
execFileSync(process.env.EDIT_FFMPEG_PATH || "ffmpeg", [
  "-hide_banner",
  "-loglevel",
  "error",
  "-y",
  "-f",
  "lavfi",
  "-i",
  "testsrc2=size=360x640:rate=24:duration=3",
  "-c:v",
  "libx264",
  "-pix_fmt",
  "yuv420p",
  "-an",
  video,
]);
console.log(
  "Synthetic Studio fixture created. Start apps/app with UI_AUDIT_PREVIEW=1 on port 4100.",
);

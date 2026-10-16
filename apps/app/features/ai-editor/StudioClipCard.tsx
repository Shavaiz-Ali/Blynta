"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppButton, AppDropdown, type ViewMode } from "@blynta/ui";
import { MoreVertical, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  ClipLibraryCard,
  ClipLibraryThumbnail,
} from "@/features/jobs/components/ClipLibraryCard";
import { formatDate, platformIcon } from "@/features/dashboard/utils";
import { editTime } from "./presentation";
import type { StudioClip, StudioProject } from "./contracts";
export function projectStatus(
  project: Pick<StudioProject, "revision" | "latestPreview">,
) {
  const current =
    project.latestPreview?.revision === project.revision
      ? project.latestPreview
      : null;
  if (current?.status === "completed") return "Preview ready";
  if (current?.status === "queued" || current?.status === "processing")
    return "Rendering";
  if (current?.status === "failed") return "Render failed";
  return project.revision > 1 ? "Changes pending" : null;
}
export function StudioClipCard({
  clip,
  viewMode,
}: {
  clip: StudioClip;
  viewMode: ViewMode;
}) {
  const router = useRouter();
  const href = `/studio/${clip._id}?jobId=${clip.jobId}`;
  const state = clip.editing?.hasActivity ? projectStatus(clip.editing) : null;
  const menu = (
    <AppDropdown
      trigger={
        <AppButton
          variant="ghost"
          size="icon-sm"
          aria-label={`Actions for ${clip.title}`}
        >
          <MoreVertical className="size-4" />
        </AppButton>
      }
      items={[
        { label: "Edit with AI", onClick: () => router.push(href) },
        {
          label: "View original clip",
          onClick: () =>
            router.push(`/my-clips/${clip.jobId}/clips/${clip._id}`),
        },
      ]}
    />
  );
  return (
    <ClipLibraryCard
      viewMode={viewMode}
      thumbnail={
        <ClipLibraryThumbnail
          viewMode={viewMode}
          thumbnail={clip.thumbnailUrl}
          title={clip.title}
          duration={editTime(clip.duration)}
          platform={clip.sourcePlatform}
          platformIcon={
            clip.sourcePlatform
              ? platformIcon(clip.sourcePlatform, "h-3 w-3")
              : undefined
          }
          hoverLabel="Edit with AI"
        />
      }
      title={
        <Link
          href={href}
          aria-label={`Edit with AI: ${clip.title}`}
          className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring"
        >
          {clip.title}
        </Link>
      }
      metadata={
        <>
          <span>{formatDate(clip.createdAt)}</span>
          {clip.uploader && (
            <>
              <span>•</span>
              <span
                className={
                  viewMode === "list"
                    ? "truncate max-w-[140px]"
                    : "truncate max-w-[120px]"
                }
              >
                {clip.uploader}
              </span>
            </>
          )}
        </>
      }
      status={
        state ? (
          <Badge
            variant={state === "Render failed" ? "destructive" : "secondary"}
            className={`text-[11px] font-semibold ${state === "Render failed" ? "border-destructive/50 bg-destructive/10 text-foreground" : "bg-primary/10 text-primary border-primary/20"}`}
          >
            {state}
          </Badge>
        ) : undefined
      }
      actions={
        <>
          {viewMode === "list" && (
            <AppButton
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={href} />}
              icon={<ArrowRight className="h-3.5 w-3.5" />}
              iconPosition="right"
              className="h-8 text-xs font-semibold hover:border-primary hover:text-primary shadow-2xs"
            >
              Edit with AI
            </AppButton>
          )}
          {menu}
        </>
      }
    />
  );
}

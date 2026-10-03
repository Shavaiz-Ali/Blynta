"use client";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
  Film,
  Play,
  ArrowUpRight,
} from "lucide-react";
import { AppDropdownMenu } from "@/components/common/AppDropdownMenu";
import { AppButton } from "@blynta/ui";
import { AppCard } from "@blynta/ui";
import type { Project } from "../../types";
export function ProjectCard({
  project,
  index,
  onAction,
  recent,
}: {
  project: Project;
  index: number;
  recent?: boolean;
  onAction: (
    action: "rename" | "duplicate" | "delete",
    project: Project,
  ) => void;
}) {
  const router = useRouter();
  const duration = Math.max(
    0,
    ...project.clips.map((c) => c.start + c.duration),
  );
  const cover = project.assets.find(
    (a) => (a.thumbnail || a.src) && (a.kind === "video" || a.kind === "image"),
  );
  return (
    <AppCard className="project-card">
      <Link href={`/editor/${project.id}`} className="project-link group">
        <div className={`project-cover scene-${index % 3}`}>
          <div
            className={
              project.demo
                ? "demo-scene h-full"
                : "h-full bg-muted flex items-center justify-center text-muted-foreground"
            }
          >
            {cover ? (
              cover.thumbnail || cover.kind === "image" ? (
                <Image
                  src={(cover.thumbnail || cover.src)!}
                  alt=""
                  fill
                  unoptimized
                  style={{ objectFit: "cover" }}
                />
              ) : (
                <video
                  src={cover.src}
                  muted
                  preload="metadata"
                  className="project-thumbnail-video"
                />
              )
            ) : (
              !project.demo && <Film size={32} />
            )}
          </div>
          <span className="cover-open">
            <Play size={18} />
            Open editor
          </span>
          <span className="cover-metadata">
            <span>
              {Math.floor(duration / 60)}:
              {String(Math.floor(duration % 60)).padStart(2, "0")}
            </span>
            <span>{project.ratio}</span>
          </span>
        </div>
        <div className="project-details">
          <h3 className="truncate font-medium text-sm group-hover:text-primary">
            {project.name}
          </h3>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Edited{" "}
            {new Intl.DateTimeFormat("en", {
              month: "short",
              day: "numeric",
            }).format(new Date(project.updatedAt))}
          </p>
          <p className="project-source">
            {project.source ??
              (project.demo
                ? "Blynta Clip"
                : project.assets.length
                  ? "Imported"
                  : "Studio")}
            {recent && <span className="continue-label">Continue editing</span>}
          </p>
        </div>
      </Link>
      <div className="project-actions">
        <AppDropdownMenu
          trigger={
            <AppButton
              variant="ghost"
              size="icon-sm"
              aria-label={`Options for ${project.name}`}
            >
              <MoreHorizontal />
            </AppButton>
          }
          items={[
            {
              label: "Open editor",
              icon: <ArrowUpRight />,
              onClick: () => router.push(`/editor/${project.id}`),
            },
            {
              label: "Rename",
              icon: <Pencil />,
              onClick: () => onAction("rename", project),
            },
            {
              label: "Duplicate",
              icon: <Copy />,
              onClick: () => onAction("duplicate", project),
            },
            {
              label: "Delete",
              icon: <Trash2 />,
              destructive: true,
              separator: true,
              onClick: () => onAction("delete", project),
            },
          ]}
        />
      </div>
    </AppCard>
  );
}

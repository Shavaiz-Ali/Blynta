"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
  Film,
  Play,
  AudioLines,
  Type,
} from "lucide-react";
import { AppButton, AppCardRoot, AppDropdown } from "@blynta/ui";
import type { Project } from "../../types";
import {
  projectDuration,
  projectEdited,
  projectSource,
  type ProjectActionHandler,
} from "../project-display";

export function ProjectThumbnail({
  project,
  metadata = true,
}: {
  project: Project;
  metadata?: boolean;
}) {
  const [failedSource, setFailedSource] = useState<string>();
  const cover = project.assets.find(
    (asset) =>
      (asset.thumbnail || (asset.kind === "image" && asset.src)) &&
      (asset.kind === "video" || asset.kind === "image"),
  );
  const src = cover?.thumbnail || cover?.src;
  const PlaceholderIcon = project.assets.some((asset) => asset.kind === "audio")
    ? AudioLines
    : project.assets.some((asset) => asset.kind === "text")
      ? Type
      : Film;
  return (
    <div className="studio-project-cover">
      {src && src !== failedSource ? (
        <Image
          src={src}
          alt=""
          fill
          unoptimized
          sizes="(max-width: 639px) 100vw, (max-width: 1023px) 45vw, 320px"
          className="object-cover"
          onError={() => setFailedSource(src)}
        />
      ) : (
        <div className="studio-media-placeholder" aria-hidden="true">
          <span className="placeholder-frame">
            <PlaceholderIcon size={32} strokeWidth={1.25} />
          </span>
          <span className="placeholder-timeline">
            <i />
            <i />
            <i />
          </span>
        </div>
      )}
      {metadata && (
        <>
          <span className="studio-cover-open">
            <Play size={17} />
            Open editor
          </span>
          <span className="studio-cover-metadata">
            <span>{projectDuration(project)}</span>
            <span>{project.ratio}</span>
          </span>
        </>
      )}
    </div>
  );
}

export function ProjectActions({
  project,
  onAction,
  busy,
}: {
  project: Project;
  onAction: ProjectActionHandler;
  busy?: boolean;
}) {
  return (
    <AppDropdown
      contentClassName="rounded-md shadow-sm bg-popover"
      trigger={
        <AppButton
          variant="ghost"
          size="icon-sm"
          disabled={busy}
          aria-label={`Options for ${project.name}`}
        >
          <MoreHorizontal />
        </AppButton>
      }
      items={[
        {
          label: "Rename",
          icon: <Pencil size={15} />,
          onClick: () => onAction("rename", project),
        },
        {
          label: "Duplicate",
          icon: <Copy size={15} />,
          onClick: () => onAction("duplicate", project),
        },
        {
          label: "Delete",
          icon: <Trash2 size={15} />,
          destructive: true,
          separatorBefore: true,
          onClick: () => onAction("delete", project),
        },
      ]}
    />
  );
}

export function ProjectCard({
  project,
  onAction,
  onPrepare,
  busy,
}: {
  project: Project;
  onAction: ProjectActionHandler;
  onPrepare?: (project: Project) => void;
  busy?: boolean;
}) {
  return (
    <AppCardRoot className="studio-project-card">
      <Link
        href={`/editor/${project.id}`}
        className="studio-project-link"
        aria-label={`Open ${project.name} in editor`}
        onPointerEnter={() => onPrepare?.(project)}
        onFocus={() => onPrepare?.(project)}
      >
        <ProjectThumbnail project={project} />
        <div className="studio-project-details">
          <h3 title={project.name}>{project.name}</h3>
          <p>
            Edited{" "}
            <time dateTime={project.updatedAt}>{projectEdited(project)}</time>
          </p>
          <span className="studio-project-source">
            {projectSource(project)}
          </span>
        </div>
      </Link>
      <div className="studio-project-actions">
        <ProjectActions project={project} onAction={onAction} busy={busy} />
      </div>
    </AppCardRoot>
  );
}

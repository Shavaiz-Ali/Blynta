import type { Project } from "../types";

export function projectSource(project: Project) {
  return (
    project.source ??
    (project.demo
      ? "Blynta Clip"
      : project.assets.length
        ? "Imported"
        : "Studio")
  );
}

export function projectDuration(project: Project) {
  const seconds = Math.max(
    0,
    ...project.clips.map((clip) => clip.start + clip.duration),
  );
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

export function projectEdited(project: Project) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(project.updatedAt));
}

export type ProjectAction = "rename" | "duplicate" | "delete";
export type ProjectActionHandler = (
  action: ProjectAction,
  project: Project,
) => void;

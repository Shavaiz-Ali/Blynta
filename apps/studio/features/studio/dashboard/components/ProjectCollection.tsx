import Link from "next/link";
import { AppCard } from "@blynta/ui";
import type { Project } from "../../types";
import { ProjectCard, ProjectActions, ProjectThumbnail } from "./ProjectCard";
import {
  projectDuration,
  projectEdited,
  projectSource,
  type ProjectActionHandler,
} from "../project-display";

export function ProjectCollection({
  projects,
  list = false,
  onAction,
  onPrepare,
  busy,
}: {
  projects: Project[];
  list?: boolean;
  onAction: ProjectActionHandler;
  onPrepare?: (project: Project) => void;
  busy?: boolean;
}) {
  if (!list)
    return (
      <div className="studio-project-grid">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onAction={onAction}
            onPrepare={onPrepare}
            busy={busy}
          />
        ))}
      </div>
    );
  return (
    <AppCard
      className="studio-project-table p-0 rounded-xl"
      contentClassName="p-0"
      useDefaultClasses={false}
      role="table"
      aria-label="Projects"
    >
      <div className="studio-project-table-header" role="row">
        <span role="columnheader">Project</span>
        <span role="columnheader">Source</span>
        <span role="columnheader">Duration</span>
        <span role="columnheader">Last edited</span>
        <span role="columnheader" className="sr-only">
          Actions
        </span>
      </div>
      {projects.map((project) => (
        <div key={project.id} className="studio-project-row" role="row">
          <div role="cell" className="studio-project-row-title">
            <Link
              href={`/editor/${project.id}`}
              aria-label={`Open ${project.name} in editor`}
              onPointerEnter={() => onPrepare?.(project)}
              onFocus={() => onPrepare?.(project)}
            >
              <ProjectThumbnail project={project} metadata={false} />
              <span>
                <strong title={project.name}>{project.name}</strong>
                <small>{project.ratio}</small>
              </span>
            </Link>
          </div>
          <span role="cell" className="studio-project-row-source">
            {projectSource(project)}
          </span>
          <span role="cell" className="studio-project-row-duration">
            {projectDuration(project)}
          </span>
          <time
            role="cell"
            className="studio-project-row-date"
            dateTime={project.updatedAt}
          >
            {projectEdited(project)}
          </time>
          <div role="cell">
            <ProjectActions project={project} onAction={onAction} busy={busy} />
          </div>
        </div>
      ))}
    </AppCard>
  );
}

export function RecentProjects({
  projects,
  onAction,
  onPrepare,
  busy,
}: {
  projects: Project[];
  onAction: ProjectActionHandler;
  onPrepare?: (project: Project) => void;
  busy?: boolean;
}) {
  return (
    <section
      className="workspace-section studio-recent-projects"
      aria-labelledby="recent-projects-heading"
    >
      <div className="workspace-section-heading">
        <div>
          <h2 id="recent-projects-heading">Recent projects</h2>
          <p>Pick up where you left off</p>
        </div>
        <a className="workspace-text-link" href="#all-projects">
          View all
        </a>
      </div>
      <ProjectCollection
        projects={projects}
        onAction={onAction}
        onPrepare={onPrepare}
        busy={busy}
      />
    </section>
  );
}

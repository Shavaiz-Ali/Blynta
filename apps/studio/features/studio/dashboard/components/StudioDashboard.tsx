"use client";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { AppButton, AppDialog, AppInput, AppSkeleton } from "@blynta/ui";
import { useProjects } from "../../projects/hooks/useProjects";
import { NewProjectDialog } from "../../projects/components/NewProjectDialog";
import type { Project } from "../../types";
import { studioRequest } from "../../api";
import { toast } from "sonner";
import { StudioShell } from "./StudioShell";
import { QuickStart, FromBlyntaDialog, type CreationMode } from "./QuickStart";
import { ProjectsToolbar } from "./ProjectsToolbar";
import { ProjectCollection, RecentProjects } from "./ProjectCollection";
import {
  ProjectsSkeleton,
  ProjectsEmptyState,
  ProjectsError,
} from "./ProjectsStates";
import { projectSource, type ProjectAction } from "../project-display";

export function StudioDashboard() {
  return <DashboardWorkspace {...useProjects()} />;
}

export function DashboardWorkspace({
  projects,
  ready,
  error,
  update,
  retry,
  retrying,
  prepare,
}: {
  projects: Project[];
  ready: boolean;
  error?: string;
  update: (projects: Project[]) => Promise<void>;
  retry?: () => void;
  retrying?: boolean;
  prepare?: (project: Project) => void;
}) {
  const [search, setSearch] = useState("");
  const [creation, setCreation] = useState<CreationMode | null>(null);
  const [blyntaOpen, setBlyntaOpen] = useState(false);
  const [list, setList] = useState(false);
  const [sort, setSort] = useState("recent");
  const [filter, setFilter] = useState("all");
  const [action, setAction] = useState<{
    type: "rename" | "delete";
    project: Project;
  } | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const recent = useMemo(
    () =>
      [...projects]
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
        .slice(0, 4),
    [projects],
  );
  const importedCount = projects.filter((project) =>
    projectSource(project).startsWith("Blynta"),
  ).length;
  const filtered = useMemo(
    () =>
      projects
        .filter(
          (project) =>
            project.name.toLowerCase().includes(search.trim().toLowerCase()) &&
            (filter === "all" ||
              (filter === "blynta"
                ? projectSource(project).startsWith("Blynta")
                : projectSource(project) === filter)),
        )
        .sort((a, b) =>
          sort === "name"
            ? a.name.localeCompare(b.name)
            : sort === "oldest"
              ? Date.parse(a.updatedAt) - Date.parse(b.updatedAt)
              : Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
        ),
    [projects, search, filter, sort],
  );
  async function onAction(type: ProjectAction, project: Project) {
    if (busy) return;
    if (type === "duplicate") {
      setBusy(true);
      try {
        await studioRequest(`projects/${project.id}/duplicate`, "POST", {});
        await update(projects);
        toast.success("Project duplicated");
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not duplicate project",
        );
      } finally {
        setBusy(false);
      }
    } else {
      setAction({ type, project });
      setName(project.name);
      setActionError("");
    }
  }
  async function saveAction() {
    if (!action || busy) return;
    setBusy(true);
    setActionError("");
    try {
      await update(
        action.type === "delete"
          ? projects.filter((project) => project.id !== action.project.id)
          : projects.map((project) =>
              project.id === action.project.id
                ? {
                    ...project,
                    name: name.trim(),
                    updatedAt: new Date().toISOString(),
                  }
                : project,
            ),
      );
      toast.success(
        action.type === "delete" ? "Project deleted" : "Project renamed",
      );
      setAction(null);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Could not update project. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <StudioShell
      onNew={() => setCreation("blank")}
      onBlynta={() => setBlyntaOpen(true)}
    >
      <div className="studio-dashboard-body">
        <div className="workspace-page-heading">
          <div>
            <p className="workspace-eyebrow">Your workspace</p>
            <h1>Projects</h1>
            <p>Create, organize, and keep your next edit moving.</p>
          </div>
          <AppButton onClick={() => setCreation("blank")} icon={<Plus />}>
            New project
          </AppButton>
        </div>
        <QuickStart onNew={setCreation} onBlynta={() => setBlyntaOpen(true)} />
        {!ready && !error && (
          <section
            className="workspace-section studio-recent-projects"
            aria-labelledby="loading-recent-heading"
          >
            <div className="workspace-section-heading">
              <div>
                <h2 id="loading-recent-heading">Recent projects</h2>
                <p>Pick up where you left off</p>
              </div>
            </div>
            <ProjectsSkeleton />
          </section>
        )}
        {ready && recent.length > 0 && (
          <RecentProjects
            projects={recent}
            onAction={onAction}
            onPrepare={prepare}
            busy={busy}
          />
        )}
        <section
          id="all-projects"
          className="workspace-section"
          aria-labelledby="all-projects-heading"
        >
          <div className="workspace-section-heading">
            <div>
              <h2 id="all-projects-heading">
                All projects{" "}
                {ready && (
                  <span className="workspace-count">{projects.length}</span>
                )}
              </h2>
              <p>Your Studio projects, all in one place</p>
            </div>
          </div>
          {(projects.length > 0 || (!ready && !error)) && (
            <ProjectsToolbar
              search={search}
              onSearch={setSearch}
              filter={filter}
              onFilter={setFilter}
              sort={sort}
              onSort={setSort}
              list={list}
              onList={setList}
            />
          )}
          {error && (
            <ProjectsError
              error={error}
              onRetry={() => retry?.()}
              retrying={retrying}
            />
          )}
          {!ready && !error ? (
            <>
              <div className="project-result-count">
                <AppSkeleton className="h-3 w-16" />
              </div>
              <ProjectsSkeleton />
            </>
          ) : projects.length > 0 && filtered.length > 0 ? (
            <>
              <p className="project-result-count" role="status">
                {filtered.length}{" "}
                {filtered.length === 1 ? "project" : "projects"}
                {search.trim() || filter !== "all" ? " found" : ""}
              </p>
              <ProjectCollection
                projects={filtered}
                list={list}
                onAction={onAction}
                onPrepare={prepare}
                busy={busy}
              />
            </>
          ) : (
            !error && (
              <ProjectsEmptyState
                filtered={!!search.trim() || filter !== "all"}
                onClear={() => {
                  setSearch("");
                  setFilter("all");
                }}
                onNew={setCreation}
                onBlynta={() => setBlyntaOpen(true)}
              />
            )
          )}
        </section>
      </div>
      <NewProjectDialog
        key={creation ?? "closed"}
        open={!!creation}
        initialMode={creation ?? "blank"}
        onOpenChange={(open) => !open && setCreation(null)}
        onCreate={(project) => update([project, ...projects])}
      />
      <FromBlyntaDialog
        open={blyntaOpen}
        onOpenChange={setBlyntaOpen}
        importedCount={importedCount}
        onImported={() => {
          setFilter("blynta");
          setSearch("");
          setBlyntaOpen(false);
          document
            .getElementById("all-projects")
            ?.scrollIntoView({ block: "start" });
        }}
      />
      <AppDialog
        open={!!action}
        onOpenChange={(open) => {
          if (!open && !busy) setAction(null);
        }}
        title={action?.type === "delete" ? "Delete project?" : "Rename project"}
        description={
          action?.type === "delete"
            ? `“${action.project.name}” will be removed from your account. This cannot be undone.`
            : "Update the name shown in your project library."
        }
        footer={
          <>
            <AppButton
              variant="outline"
              disabled={busy}
              onClick={() => setAction(null)}
            >
              Cancel
            </AppButton>
            <AppButton
              disabled={action?.type === "rename" && !name.trim()}
              isLoading={busy}
              variant={action?.type === "delete" ? "destructive" : "default"}
              onClick={saveAction}
            >
              {action?.type === "delete" ? "Delete project" : "Save name"}
            </AppButton>
          </>
        }
      >
        {action?.type === "rename" && (
          <AppInput
            label="Project name"
            autoFocus
            value={name}
            maxLength={100}
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) void saveAction();
            }}
          />
        )}
        {actionError && (
          <p role="alert" className="text-sm text-destructive">
            {actionError}
          </p>
        )}
      </AppDialog>
    </StudioShell>
  );
}

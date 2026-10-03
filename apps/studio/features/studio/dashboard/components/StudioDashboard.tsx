"use client";
import { useState } from "react";
import {
  Plus,
  Search,
  Grid2X2,
  List,
  ArrowUpRight,
  FolderOpen,
} from "lucide-react";
import { AppButton } from "@blynta/ui";
import { AppDialog } from "@blynta/ui";
import { AppInput } from "@blynta/ui";
import { AppSelect } from "@blynta/ui";
import { AppTooltip } from "@/components/common/AppTooltip";
import { StudioLogo } from "@/components/common/StudioLogo";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { UserDropdown } from "@/components/common/UserDropdown";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { useProjects } from "../../projects/hooks/useProjects";
import { NewProjectDialog } from "../../projects/components/NewProjectDialog";
import { ProjectCard } from "./ProjectCard";
import type { Project } from "../../types";
import { studioRequest } from "../../api";
import { toast } from "sonner";
import { blyntaUrl } from "@/config/env";
export function StudioDashboard() {
  return <DashboardWorkspace {...useProjects()} />;
}
export function DashboardWorkspace({
  projects,
  ready,
  error,
  update,
}: {
  projects: Project[];
  ready: boolean;
  error?: string;
  update: (projects: Project[]) => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [list, setList] = useState(false);
  const [sort, setSort] = useState("recent");
  const [filter, setFilter] = useState("all");
  const [action, setAction] = useState<{
    type: "rename" | "delete";
    project: Project;
  } | null>(null);
  const [name, setName] = useState("");
  async function onAction(type: "rename" | "duplicate" | "delete", project: Project) {
    if (type === "duplicate") {
      try {
        await studioRequest(`projects/${project.id}/duplicate`, 'POST', {});
        await update(projects);
      } catch (error) { toast.error(error instanceof Error ? error.message : "Could not duplicate project"); }
    } else {
      setAction({ type, project });
      setName(project.name);
    }
  }
  const recent = [...projects].sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  )[0];
  const filtered = projects
    .filter(
      (p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) &&
        (filter === "all" ||
          (p.source ??
            (p.demo
              ? "Blynta Clip"
              : p.assets.length
                ? "Imported"
                : "Studio")) === filter),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "oldest"
          ? Date.parse(a.updatedAt) - Date.parse(b.updatedAt)
          : Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
    );
  return (
    <main className="min-h-screen bg-background">
      <header className="studio-header">
        <div className="flex items-center gap-5">
          <StudioLogo />
          <span className="border-l h-5" />
          <span className="text-sm font-medium">Projects</span>
        </div>
        <div className="flex items-center gap-2">
          <a
            className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mr-3"
            href={blyntaUrl}
          >
            Blynta
            <ArrowUpRight size={14} />
          </a>
          <ThemeToggle />
          <UserDropdown />
        </div>
      </header>
      <div className="dashboard-body">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Manage your Studio projects.
            </p>
          </div>
          <AppButton onClick={() => setNewOpen(true)} icon={<Plus />}>
            New project
          </AppButton>
        </div>
        <section className="mt-9">
          {!!projects.length && (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold">
                  {sort === "recent" ? "Recent" : "Projects"}{" "}
                  <span className="ml-2 font-normal text-muted-foreground">
                    {projects.length}
                  </span>
                </h2>
              </div>
              <div className="library-toolbar">
                <AppInput
                  prefixIcon={<Search size={15} />}
                  aria-label="Search projects"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search projects"
                  wrapperClassName="flex-1 min-w-40 max-w-sm"
                />
                <AppSelect
                  aria-label="Filter projects"
                  value={filter}
                  onValueChange={setFilter}
                  options={[
                    { value: "all", label: "All sources" },
                    ...["Studio", "Blynta Clip", "Blynta Job", "Imported"].map(
                      (value) => ({ value, label: value }),
                    ),
                  ]}
                  wrapperClassName="w-36!"
                />
                <AppSelect
                  aria-label="Sort projects"
                  value={sort}
                  onValueChange={setSort}
                  options={[
                    { value: "recent", label: "Last edited" },
                    { value: "name", label: "Name A–Z" },
                    { value: "oldest", label: "Oldest first" },
                  ]}
                  wrapperClassName="w-36!"
                />
                <div className="flex gap-1 border rounded-md p-0.5">
                  <AppTooltip content="Grid view">
                    <AppButton
                      aria-label="Grid view"
                      aria-pressed={!list}
                      variant={!list ? "secondary" : "ghost"}
                      size="icon-sm"
                      onClick={() => setList(false)}
                    >
                      <Grid2X2 />
                    </AppButton>
                  </AppTooltip>
                  <AppTooltip content="List view">
                    <AppButton
                      aria-label="List view"
                      aria-pressed={list}
                      variant={list ? "secondary" : "ghost"}
                      size="icon-sm"
                      onClick={() => setList(true)}
                    >
                      <List />
                    </AppButton>
                  </AppTooltip>
                </div>
              </div>
            </>
          )}
          {error && (
            <p
              role="alert"
              className="mt-5 border rounded p-4 text-destructive text-sm"
            >
              {error}
            </p>
          )}
          {!ready && !error ? (
            <LoadingSkeleton />
          ) : filtered.length ? (
            <div className={`project-grid ${list ? "project-list" : ""}`}>
              {filtered.map((p, i) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  index={i}
                  recent={p.id === recent?.id}
                  onAction={onAction}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <FolderOpen size={32} />
              <h3>
                {search || filter !== "all"
                  ? "No matching projects"
                  : "Create your first video"}
              </h3>
              <p>
                {search || filter !== "all"
                  ? "Try another search or clear your filters."
                  : "Upload footage, start from scratch, or bring something over from Blynta."}
              </p>
              <AppButton
                variant="outline"
                onClick={() => {
                  if (search || filter !== "all") {
                    setSearch("");
                    setFilter("all");
                  } else setNewOpen(true);
                }}
              >
                {search || filter !== "all" ? "Clear filters" : "New project"}
              </AppButton>
            </div>
          )}
        </section>
        <footer className="mt-10 border-t pt-5 text-xs text-muted-foreground">
          Projects and media are saved to your Blynta account.
        </footer>
      </div>
      <NewProjectDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreate={(p) => update([p, ...projects])}
      />
      <AppDialog
        open={!!action}
        onOpenChange={(v) => !v && setAction(null)}
        title={action?.type === "delete" ? "Delete project?" : "Rename project"}
        description={
          action?.type === "delete"
            ? `“${action.project.name}” will be removed from your account. This cannot be undone.`
            : "Update the name shown in your library."
        }
        footer={
          <>
            <AppButton variant="outline" onClick={() => setAction(null)}>
              Cancel
            </AppButton>
            <AppButton
              disabled={action?.type === "rename" && !name.trim()}
              variant={action?.type === "delete" ? "destructive" : "default"}
              onClick={async () => {
                if (!action) return;
                try {
                  await update(
                    action.type === "delete"
                      ? projects.filter((p) => p.id !== action.project.id)
                      : projects.map((p) =>
                          p.id === action.project.id
                            ? {
                                ...p,
                                name: name.trim(),
                                updatedAt: new Date().toISOString(),
                              }
                            : p,
                        ),
                  );
                  setAction(null);
                } catch {}
              }}
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
            onChange={(e) => setName(e.target.value)}
          />
        )}
      </AppDialog>
    </main>
  );
}

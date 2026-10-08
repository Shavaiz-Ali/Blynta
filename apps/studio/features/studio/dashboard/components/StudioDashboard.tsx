"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@blynta/auth/react";
import { MediaLibrary, UsagePage, NotificationsPage } from "./WorkspacePages";
import { Plus, Sparkles, Captions, Ratio, Download } from "lucide-react";
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
  const view = usePathname();
  return <DashboardWorkspace view={view} {...useProjects()} />;
}

export function DashboardWorkspace({
  view = "/dashboard",
  projects,
  ready,
  error,
  update,
  retry,
  retrying,
  prepare,
}: {
  view?: string;
  projects: Project[];
  ready: boolean;
  error?: string;
  update: (projects: Project[]) => Promise<void>;
  retry?: () => void;
  retrying?: boolean;
  prepare?: (project: Project) => void;
}) {
  const pathname = view;
  const router = useRouter();
  const home = pathname === "/home";
  const projectsPage = pathname === "/dashboard";
  const { data: session } = useSession();
  const [aiPicker, setAiPicker] = useState(false);
  const [aiLaunch, setAiLaunch] = useState(true);
  const title =
    (
      {
        "/home": "Welcome back",
        "/media": "My media",
        "/from-blynta": "From Blynta",
        "/usage": "Credits / Usage",
        "/notifications": "Notifications",
      } as Record<string, string>
    )[pathname] || "Projects";
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
      onAI={() => {
        setAiLaunch(true);
        setAiPicker(true);
      }}
      onNew={() => setCreation("blank")}
    >
      <div className="studio-dashboard-body">
        <div className="workspace-page-heading">
          <div>
            <p className="workspace-eyebrow">Your workspace</p>
            <h1>
              {title}
              {home && session?.user.name
                ? `, ${session.user.name.split(" ")[0]}`
                : ""}
            </h1>
            <p>
              {home
                ? "Your next video starts here."
                : projectsPage
                  ? "Organize your projects and keep your next edit moving."
                  : "Your Blynta Studio workspace."}
            </p>
          </div>
          {(home || projectsPage || pathname === "/media") && (
            <AppButton onClick={() => setCreation("blank")} icon={<Plus />}>
              New project
            </AppButton>
          )}
        </div>
        {home && (
          <>
            <QuickStart
              onNew={setCreation}
              onBlynta={() => setBlyntaOpen(true)}
            />
            <section
              className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-5 flex flex-wrap items-center justify-between gap-4"
              aria-labelledby="studio-ai-heading"
            >
              <div>
                <h2
                  id="studio-ai-heading"
                  className="flex items-center gap-2 text-sm font-semibold"
                >
                  <Sparkles size={16} />
                  Blynta AI
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Trim footage, change aspect ratio, or adjust volume with an
                  edit proposal.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Available in the editor when your AI provider is configured.
                  You review changes before applying.
                </p>
              </div>
              <AppButton
                size="sm"
                onClick={() => {
                  setAiLaunch(true);
                  setAiPicker(true);
                }}
              >
                Choose a project →
              </AppButton>
            </section>
          </>
        )}
        {pathname === "/media" && (
          <MediaLibrary onUpload={() => setCreation("upload")} />
        )}
        {pathname === "/from-blynta" && (
          <MediaLibrary fromBlynta onUpload={() => setCreation("upload")} />
        )}
        {pathname === "/usage" && <UsagePage />}
        {pathname === "/notifications" && <NotificationsPage />}
        {home && !ready && !error && (
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
        {home && ready && recent.length > 0 && (
          <RecentProjects
            projects={recent}
            onAction={onAction}
            onPrepare={prepare}
            busy={busy}
          />
        )}
        {home && error && (
          <ProjectsError
            error={error}
            onRetry={() => retry?.()}
            retrying={retrying}
          />
        )}
        {home && ready && !projects.length && (
          <p className="mt-6 rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            Your recent projects will appear here. Create a project or bring a
            clip from Blynta to begin.
          </p>
        )}
        {projectsPage && (
          <section
            id="all-projects"
            className="workspace-section"
            aria-labelledby="all-projects-heading"
          >
            <h2 id="all-projects-heading" className="sr-only">
              Projects
            </h2>
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
        )}
        {home && (
          <section
            className="workspace-section space-y-3"
            aria-labelledby="studio-tools-heading"
          >
            <h2 id="studio-tools-heading" className="text-sm font-semibold">
              Studio tools
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  title: "Captions",
                  description:
                    "Add captions from an available source transcript.",
                  icon: Captions,
                },
                {
                  title: "Resize",
                  description:
                    "Set your canvas to vertical, square, or widescreen.",
                  icon: Ratio,
                },
                {
                  title: "Export",
                  description: "Render your timeline to a downloadable MP4.",
                  icon: Download,
                },
              ].map((tool) => (
                <AppButton
                  key={tool.title}
                  variant="outline"
                  className="h-auto justify-start whitespace-normal p-4 text-left"
                  onClick={() => {
                    setAiLaunch(false);
                    setAiPicker(true);
                  }}
                >
                  <tool.icon size={18} />
                  <span>
                    <strong className="block text-xs">{tool.title}</strong>
                    <span className="block mt-1 text-xs text-muted-foreground font-normal">
                      {tool.description}
                    </span>
                  </span>
                </AppButton>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Tools operate on a project in the editor.
            </p>
          </section>
        )}
      </div>
      <AppDialog
        open={aiPicker}
        onOpenChange={setAiPicker}
        title="Choose a project to edit"
        description="Open your project, then use Blynta AI or the editor tools. AI proposals support trimming, aspect ratio, and volume; captions use an available transcript."
      >
        <div className="max-h-80 overflow-y-auto space-y-2">
          {!ready && !error && (
            <p className="text-sm text-muted-foreground">Loading projects…</p>
          )}
          {error && (
            <ProjectsError
              error={error}
              onRetry={() => retry?.()}
              retrying={retrying}
            />
          )}
          {recent.map((project) => (
            <Link
              key={project.id}
              href={`/editor/${project.id}${aiLaunch ? "?ai=1" : ""}`}
              className="block rounded-lg border p-3 text-sm font-medium hover:bg-muted"
            >
              {project.name}
              <span className="float-right text-muted-foreground">Open →</span>
            </Link>
          ))}
          {projects.length > 4 && (
            <Link href="/dashboard" className="block text-xs text-primary">
              Browse all projects
            </Link>
          )}
          <AppButton
            variant="outline"
            onClick={() => {
              setAiPicker(false);
              setCreation("upload");
            }}
          >
            Upload to a new project
          </AppButton>
        </div>
      </AppDialog>
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
          if (!projectsPage) {
            setBlyntaOpen(false);
            router.push("/from-blynta");
            return;
          }
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

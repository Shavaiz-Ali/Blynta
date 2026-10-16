"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Clapperboard, Plus, Search } from "lucide-react";
import {
  AppButton,
  AppCard,
  AppInput,
  AppSelect,
  AppPagination,
  AppQueryState,
  AppTabs,
  AppTabsContent,
  AppTabsList,
  AppTabsTrigger,
  AppViewModeToggle,
} from "@blynta/ui";
import { PageContent } from "@/components/layout/PageContent";
import { useViewMode } from "@/features/dashboard/use-view-mode";
import { useStudioClips, useStudioProjects } from "./queries";
import { StudioClipCard, projectStatus } from "./StudioClipCard";
import { StudioClipPicker } from "./StudioClipPicker";
import { StudioListingSkeleton } from "./StudioListingSkeleton";

type Tab = "projects" | "clips";
const initial = { search: "", query: "", page: 1, sort: "updated" };
export function StudioLanding() {
  const [tab, setTab] = useState<Tab>("projects");
  const [filters, setFilters] = useState({
    projects: initial,
    clips: { ...initial, sort: "newest" },
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [viewMode, setViewMode] = useViewMode("blynta_studio_view_mode");
  const current = filters[tab];
  function update(patch: Partial<typeof initial>) {
    setFilters((value) => ({ ...value, [tab]: { ...value[tab], ...patch } }));
  }
  useEffect(() => {
    const timer = setTimeout(
      () =>
        setFilters((value) => {
          const selected = value[tab];
          if (selected.query === selected.search.trim()) return value;
          return {
            ...value,
            [tab]: { ...selected, query: selected.search.trim(), page: 1 },
          };
        }),
      300,
    );
    return () => clearTimeout(timer);
  }, [tab, current.search]);
  const projects = useStudioProjects(
    current.query,
    tab === "projects" ? current.sort : "updated",
    current.page,
    tab === "projects",
  );
  const clips = useStudioClips(
    current.query,
    tab === "clips" ? current.sort : "newest",
    current.page,
    tab === "clips",
  );
  const active = tab === "projects" ? projects : clips;
  const changing =
    active.isPlaceholderData || current.search.trim() !== current.query;
  const date = (value: string) =>
    new Date(value).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  return (
    <PageContent>
      <div className="flex flex-col gap-4 border-b border-border/60 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            AI Studio
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Create and manage AI-powered edits for your clips.
          </p>
        </div>
        <AppButton
          size="sm"
          icon={<Plus className="size-4" />}
          className="h-9 self-start font-semibold shadow-sm md:self-auto"
          onClick={() => setPickerOpen(true)}
        >
          New AI Edit
        </AppButton>
      </div>
      <AppTabs
        value={tab}
        onValueChange={(value) => setTab(value as Tab)}
        className="space-y-6"
      >
        <AppCard
          className="py-0"
          contentClassName="flex-col gap-4 lg:flex-row lg:items-center"
        >
          <AppTabsListForListing />
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            <AppInput
              aria-label={
                tab === "projects" ? "Search projects" : "Search clips"
              }
              placeholder={
                tab === "projects" ? "Search projects…" : "Search clips…"
              }
              value={current.search}
              maxLength={100}
              onChange={(e) => update({ search: e.target.value })}
              prefixIcon={<Search className="size-3.5" />}
              wrapperClassName="min-w-0 basis-full sm:w-60 sm:basis-auto sm:flex-initial"
              className="bg-background/80"
            />
            <AppSelect
              aria-label="Sort AI edits"
              value={current.sort}
              onValueChange={(sort) => update({ sort, page: 1 })}
              wrapperClassName="w-[140px]"
              className="bg-background/80"
              options={
                tab === "projects"
                  ? [
                      { value: "updated", label: "Last edited" },
                      { value: "newest", label: "Newest" },
                      { value: "oldest", label: "Oldest" },
                    ]
                  : [
                      { value: "newest", label: "Newest" },
                      { value: "oldest", label: "Oldest" },
                    ]
              }
            />
            {viewMode && (
              <AppViewModeToggle mode={viewMode} onChange={setViewMode} />
            )}
          </div>
        </AppCard>
        <AppTabsContent value={tab} className="space-y-6">
          {viewMode === null || (active.isPending && !active.data) ? (
            <StudioListingSkeleton viewMode={viewMode} />
          ) : active.isError && !active.data ? (
            <AppQueryState
              description="Please retry to load this view."
              title={
                tab === "projects"
                  ? "Projects couldn’t be loaded"
                  : "Clips couldn’t be loaded"
              }
              onRetry={() => void active.refetch()}
            />
          ) : !active.data?.items.length ? (
            <AppCard
              useDefaultClasses={false}
              contentClassName="flex flex-col items-center px-6 py-14 text-center"
            >
              <Clapperboard className="mb-4 size-8 text-muted-foreground" />
              <h2 className="text-lg font-bold">
                {current.query
                  ? "No matches found"
                  : tab === "projects"
                    ? "No AI projects yet"
                    : "No clips ready to edit"}
              </h2>
              <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
                {current.query
                  ? "Try another title or clear your search."
                  : tab === "projects"
                    ? "Choose a clip and start your first AI edit. Your projects will appear here."
                    : "Create clips from a video, then bring them here to edit with AI."}
              </p>
              {current.query ? (
                <AppButton
                  variant="outline"
                  className="mt-5"
                  onClick={() => update({ search: "", query: "", page: 1 })}
                >
                  Clear search
                </AppButton>
              ) : tab === "projects" ? (
                <AppButton className="mt-5" onClick={() => setPickerOpen(true)}>
                  New AI Edit
                </AppButton>
              ) : (
                <AppButton
                  className="mt-5"
                  nativeButton={false}
                  render={<Link href="/dashboard" />}
                >
                  Create New Clips
                </AppButton>
              )}
            </AppCard>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <p>
                  {active.data.total}{" "}
                  {tab === "projects" ? "projects" : "clips"}
                </p>
                <span role="status">
                  {active.isFetching ? "Updating…" : ""}
                </span>
              </div>
              <div
                aria-busy={active.isFetching}
                inert={changing}
                className={`${viewMode === "list" ? "space-y-2.5" : "grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4"} ${changing ? "opacity-60" : ""}`}
              >
                {tab === "projects"
                  ? projects.data?.items.map((project) => (
                      <StudioClipCard
                        key={project._id}
                        href={`/studio/${project.sourceClipId}?jobId=${project.sourceJobId}`}
                        sourceHref={`/my-clips/${project.sourceJobId}/clips/${project.sourceClipId}`}
                        title={project.clipTitle}
                        thumbnail={project.thumbnailUrl}
                        duration={project.outputDuration}
                        subtitle={`Edited ${date(project.updatedAt)}`}
                        action="Open project"
                        status={projectStatus(project)}
                        viewMode={viewMode}
                      />
                    ))
                  : clips.data?.items.map((clip) => (
                      <StudioClipCard
                        key={clip._id}
                        href={`/studio/${clip._id}?jobId=${clip.jobId}`}
                        sourceHref={`/my-clips/${clip.jobId}/clips/${clip._id}`}
                        title={clip.title}
                        thumbnail={clip.thumbnailUrl}
                        duration={clip.duration}
                        subtitle={date(clip.createdAt)}
                        action={
                          clip.projectId ? "Open project" : "Edit with AI"
                        }
                        status={clip.projectId ? "AI project" : "Ready to edit"}
                        viewMode={viewMode}
                      />
                    ))}
              </div>
              {(active.data.totalPages ?? 1) > 1 && (
                <div className="rounded-xl border border-border/70 bg-card/60 p-4">
                  <AppPagination
                    page={current.page}
                    totalPages={active.data.totalPages}
                    onPageChange={(page) => update({ page })}
                    disabled={active.isFetching || changing}
                  />
                </div>
              )}
            </>
          )}
          {active.isError && active.data && (
            <p role="alert" className="text-sm text-destructive">
              Couldn’t refresh this view.{" "}
              <AppButton
                variant="link"
                size="sm"
                onClick={() => void active.refetch()}
              >
                Try again
              </AppButton>
            </p>
          )}
        </AppTabsContent>
      </AppTabs>
      <StudioClipPicker open={pickerOpen} onOpenChange={setPickerOpen} />
    </PageContent>
  );
}

function AppTabsListForListing() {
  return (
    <AppTabsList className="self-start">
      <AppTabsTrigger value="projects">My Projects</AppTabsTrigger>
      <AppTabsTrigger value="clips">All Clips</AppTabsTrigger>
    </AppTabsList>
  );
}

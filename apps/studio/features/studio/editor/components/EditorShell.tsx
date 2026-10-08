"use client";
import { useState, useRef, type CSSProperties } from "react";
import { useSession } from "@blynta/auth/react";
import { AppResizeHandle } from "@blynta/ui";
import { useQuery } from "@tanstack/react-query";
import { studioApi, studioKeys } from "../../api";
import { EditorLoading } from "./EditorLoading";
import { EditorUnavailable } from "./EditorUnavailable";
import { EditorContext, useEditorState } from "../hooks/useEditor";
import { EditorToolbar } from "./EditorToolbar";
import { MediaPanel, EditorToolRail } from "../media/MediaPanel";
import { PreviewCanvas } from "../preview/PreviewCanvas";
import { Timeline } from "../timeline/Timeline";
import { EditorTaskPanel } from "./EditorTaskPanel";
import { ExportDialog } from "./ExportDialog";
import type { Project } from "../../types";
export function EditorWorkspace({
  project,
  userId,
}: {
  project: Project;
  userId: string;
}) {
  const e = useEditorState(project, userId);
  const shell = useRef<HTMLElement>(null);
  const previewSize = (variable: string, value: number) =>
    shell.current?.style.setProperty(variable, `${value}px`);
  const taskOpen = e.aiOpen || e.inspectorOpen;
  const [exportOpen, setExportOpen] = useState(false);
  return (
    <EditorContext.Provider value={e}>
      <main
        ref={shell}
        className="flex h-dvh min-h-0 min-w-0 gap-3 overflow-hidden bg-background p-2 text-foreground md:p-3"
        data-editor-shell
        style={
          {
            "--media-width": `${e.mediaWidth}px`,
            "--left-width": e.contextOpen ? `${e.mediaWidth}px` : "0px",
            "--timeline-height": `${e.timelineHeight}px`,
            "--inspector-width": `${e.aiOpen ? e.aiWidth : e.inspectorWidth}px`,
          } as CSSProperties
        }
      >
        <EditorToolRail />
        <div
          className="flex min-h-0 min-w-0 flex-1 flex-col gap-3"
          data-main-editor
        >
          <EditorToolbar onExport={() => setExportOpen(true)} />
          <div
            className="grid min-h-0 min-w-0 flex-1 grid-rows-[minmax(0,1fr)_8px_var(--timeline-height)] [&>.resize-y]:opacity-30 [&>.resize-y:hover]:opacity-100 [&>.resize-y:focus-visible]:opacity-100 [&>.resize-y]:transition-opacity"
            data-editor-body
          >
            <div
              className={`relative grid min-h-0 min-w-0 grid-cols-[0_minmax(0,1fr)_var(--right-width)] ${e.contextOpen ? "min-[1100px]:grid-cols-[var(--left-width)_minmax(0,1fr)_var(--right-width)] min-[1100px]:gap-x-3" : ""} ${taskOpen ? "min-[980px]:[--right-width:var(--inspector-width)] min-[980px]:gap-x-3" : ""} [--right-width:0px] [&>.resize-x]:opacity-0 [&>.resize-x:hover]:opacity-100 [&>.resize-x:focus-visible]:opacity-100 [&>.resize-x]:transition-opacity [&>.resize-x]:absolute [&>.resize-x]:inset-y-0 [&>.resize-x]:z-30 [&>.resize-x]:hidden min-[1100px]:[&>.resize-x]:block [&>.resize-x:not(.resize-end)]:left-[calc(var(--left-width)+3px)] [&>.resize-end]:right-[calc(var(--right-width)+3px)]`}
              data-upper-workspace
            >
              <MediaPanel />
              {e.contextOpen && (
                <AppResizeHandle
                  label="Resize media panel"
                  axis="x"
                  value={e.mediaWidth}
                  min={260}
                  max={330}
                  onValuePreview={(value) => {
                    previewSize("--media-width", value);
                    previewSize("--left-width", value);
                  }}
                  onValueChange={e.setMediaWidth}
                />
              )}
              <PreviewCanvas />
              {taskOpen && (
                <AppResizeHandle
                  label={
                    e.aiOpen ? "Resize AI panel" : "Resize properties panel"
                  }
                  axis="x"
                  reverse
                  end
                  value={e.aiOpen ? e.aiWidth : e.inspectorWidth}
                  min={280}
                  max={360}
                  onValuePreview={(value) =>
                    previewSize("--inspector-width", value)
                  }
                  onValueChange={e.aiOpen ? e.setAiWidth : e.setInspectorWidth}
                />
              )}
              <EditorTaskPanel onExport={() => setExportOpen(true)} />
            </div>
            <AppResizeHandle
              label="Resize timeline"
              axis="y"
              reverse
              value={e.timelineHeight}
              min={180}
              max={e.maxTimeline}
              onValuePreview={(value) =>
                previewSize("--timeline-height", value)
              }
              onValueChange={e.setTimelineHeight}
            />
            <Timeline />
          </div>
          <footer className="flex h-4 shrink-0 items-center justify-between gap-3 px-1 text-[10px] text-muted-foreground">
            <span role="status">{e.saveState} · Cloud project</span>
            <span className="hidden md:inline">
              Space to play · S to split · Ctrl/⌘ K for AI
            </span>
          </footer>
        </div>
      </main>
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
    </EditorContext.Provider>
  );
}
export function EditorShell({ projectId }: { projectId: string }) {
  const { data: session } = useSession();
  const query = useQuery({
    queryKey: studioKeys.project(projectId, session?.user.id || ""),
    queryFn: () => studioApi.project(projectId),
    enabled: !!session,
    refetchOnWindowFocus: false,
  });
  const error = query.error?.message;
  if (query.isPending && !error) return <EditorLoading />;
  const project = query.data;
  if (error || !project || !session)
    return (
      <EditorUnavailable error={error} onRetry={() => void query.refetch()} />
    );
  return (
    <EditorWorkspace
      key={projectId}
      project={project}
      userId={session.user.id}
    />
  );
}

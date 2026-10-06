"use client";
import { useState, useRef, type CSSProperties } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { AppButton, AppResizeHandle } from "@blynta/ui";
import { useQuery } from "@tanstack/react-query";
import { studioApi, studioKeys } from "../../api";
import { EditorLoading } from "./EditorLoading";
import { EditorContext, useEditorState } from "../hooks/useEditor";
import { EditorToolbar } from "./EditorToolbar";
import { MediaPanel } from "../media/MediaPanel";
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
  const taskOpen = e.aiOpen || (!!e.selected && e.inspectorOpen);
  const [exportOpen, setExportOpen] = useState(false);
  return (
    <EditorContext.Provider value={e}>
      <main
        ref={shell}
        className={`editor-shell ${e.contextOpen ? "" : "context-collapsed"} ${taskOpen ? "task-open" : ""}`}
        style={
          {
            "--media-width": `${e.mediaWidth}px`,
            "--timeline-height": `${e.timelineHeight}px`,
            "--inspector-width": `${e.aiOpen ? e.aiWidth : e.inspectorWidth}px`,
          } as CSSProperties
        }
      >
        <EditorToolbar onExport={() => setExportOpen(true)} />
        <div className="editor-workspace">
          <MediaPanel />
          {e.contextOpen && (
            <AppResizeHandle
              label="Resize media panel"
              axis="x"
              value={e.mediaWidth}
              min={280}
              max={340}
              onValuePreview={(value) => previewSize("--media-width", value)}
              onValueChange={e.setMediaWidth}
            />
          )}
          <div className="editor-stage">
            <PreviewCanvas />
            {taskOpen && (
              <AppResizeHandle
                label={e.aiOpen ? "Resize AI panel" : "Resize properties panel"}
                axis="x"
                reverse
                end
                value={e.aiOpen ? e.aiWidth : e.inspectorWidth}
                min={e.aiOpen ? 380 : 280}
                max={e.aiOpen ? 440 : 340}
                onValuePreview={(value) =>
                  previewSize("--inspector-width", value)
                }
                onValueChange={e.aiOpen ? e.setAiWidth : e.setInspectorWidth}
              />
            )}
            <EditorTaskPanel />
          </div>
          <AppResizeHandle
            label="Resize timeline"
            axis="y"
            reverse
            value={e.timelineHeight}
            min={180}
            max={e.maxTimeline}
            onValuePreview={(value) => previewSize("--timeline-height", value)}
            onValueChange={e.setTimelineHeight}
          />
          <Timeline />
        </div>
        <footer className="editor-status">
          <span role="status">{e.saveState} · Cloud project</span>
          <span>Space to play · S to split · Ctrl/⌘ K for AI</span>
        </footer>
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
      <main className="p-12">
        <h1 className="text-xl font-medium">
          {error ? "Unable to open project" : "Project not found"}
        </h1>
        <p className="my-4 text-muted-foreground">
          {error ||
            "This project may have been removed or belongs to another account."}
        </p>
        {error && (
          <AppButton variant="outline" onClick={() => void query.refetch()}>
            Retry opening project
          </AppButton>
        )}
        <Link className="text-primary" href="/dashboard">
          Back to projects
        </Link>
      </main>
    );
  return (
    <EditorWorkspace
      key={projectId}
      project={project}
      userId={session.user.id}
    />
  );
}

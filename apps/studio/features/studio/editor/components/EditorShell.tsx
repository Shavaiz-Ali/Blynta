"use client";
import { useState, type CSSProperties } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { AppResizeHandle } from "@/components/common/AppResizeHandle";
import { useQuery } from "@tanstack/react-query";
import { studioApi, studioKeys } from "../../api";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
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
  const [exportOpen, setExportOpen] = useState(false);
  return (
    <EditorContext.Provider value={e}>
      <main
        className={`editor-shell ${e.contextOpen ? "" : "context-collapsed"} ${e.inspectorOpen || e.aiOpen ? "task-open" : ""}`}
        style={
          {
            "--media-width": `${e.mediaWidth}px`,
            "--timeline-height": `${Math.min(e.timelineHeight, Math.max(180, 92 + e.visibleTracks.length * 58))}px`,
            "--inspector-width": `${e.inspectorWidth}px`,
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
              max={360}
              onValueChange={e.setMediaWidth}
            />
          )}
          <div className="editor-stage">
            <PreviewCanvas />
            {(e.inspectorOpen || e.aiOpen) && (
              <AppResizeHandle
                label="Resize properties panel"
                axis="x"
                reverse
                end
                value={e.inspectorWidth}
                min={260}
                max={380}
                onValueChange={e.setInspectorWidth}
              />
            )}
            <EditorTaskPanel />
          </div>
          <AppResizeHandle
            label="Resize timeline"
            axis="y"
            reverse
            value={Math.min(
              e.timelineHeight,
              Math.max(180, 92 + e.visibleTracks.length * 58),
            )}
            min={180}
            max={Math.min(
              e.maxTimeline,
              Math.max(180, 92 + e.visibleTracks.length * 58),
            )}
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
  if (query.isPending && !error) return <LoadingSkeleton />;
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

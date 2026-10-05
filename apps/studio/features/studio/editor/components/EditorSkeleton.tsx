"use client";
import { useWorkspaceLayout } from "../hooks/useWorkspaceLayout";
import type { CSSProperties } from "react";
import { AppHeader, AppSkeleton } from "@blynta/ui";
export function EditorSkeleton() {
  const layout = useWorkspaceLayout();
  return (
    <main
      className={`editor-shell editor-loading ${layout.contextOpen ? "" : "context-collapsed"} ${layout.inspectorOpen ? "task-open" : ""}`}
      style={
        {
          "--media-width": `${layout.mediaWidth}px`,
          "--inspector-width": `${layout.inspectorWidth}px`,
          "--timeline-height": "180px",
        } as CSSProperties
      }
      role="status"
      aria-label="Loading editor"
    >
      <span className="sr-only">Loading editor</span>
      <AppHeader className="editor-toolbar">
        <AppSkeleton className="h-8 w-8" />
        <div className="editor-brand">
          <AppSkeleton className="h-6 w-36" />
        </div>
        <div className="project-name">
          <AppSkeleton className="h-8 w-full" />
        </div>
        <div className="editor-actions ml-auto flex items-center gap-1.5">
          {Array.from({ length: 6 }, (_, i) => (
            <AppSkeleton key={i} className="h-8 w-8 shrink-0" />
          ))}
        </div>
      </AppHeader>
      <div className="editor-workspace">
        <aside className="media-area">
          <div className="tool-rail">
            {Array.from({ length: 7 }, (_, i) => (
              <AppSkeleton
                key={i}
                className="h-8 md:h-14 w-12 md:w-full shrink-0"
              />
            ))}
          </div>
          <div className="tool-panel">
            <div className="panel-heading">
              <AppSkeleton className="h-4 w-28" />
            </div>
            <div className="media-panel-body">
              <AppSkeleton className="h-9 w-full" />
              <AppSkeleton className="mt-4 h-8 w-full" />
              <div className="media-library-grid">
                {Array.from({ length: 4 }, (_, i) => (
                  <AppSkeleton key={i} className="aspect-[1.35] w-full" />
                ))}
              </div>
            </div>
          </div>
        </aside>
        <div className="editor-stage">
          <section className="preview-area">
            <div className="preview-heading">
              <AppSkeleton className="h-4 w-48" />
            </div>
            <div className="preview-stage">
              <AppSkeleton
                className="preview-frame border border-border bg-background/70!"
                style={
                  {
                    aspectRatio: "16/9",
                    "--frame-ratio": 16 / 9,
                  } as CSSProperties
                }
              />
            </div>
            <div className="preview-controls">
              <AppSkeleton className="my-3 h-8 w-full" />
              <AppSkeleton className="h-1.5 w-full" />
            </div>
          </section>
          <div className="right-workspace" hidden={!layout.inspectorOpen}>
            <div className="workspace-panel-heading">
              <AppSkeleton className="h-8 w-28" />
            </div>
            <div className="inspector-body grid gap-6">
              {Array.from({ length: 5 }, (_, i) => (
                <AppSkeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </div>
          <div className="property-rail">
            {Array.from({ length: 4 }, (_, i) => (
              <AppSkeleton key={i} className="h-14 w-full shrink-0" />
            ))}
          </div>
        </div>
        <div className="workspace-resizer resize-y" />
        <section className="timeline-area">
          <div className="timeline-toolbar">
            <AppSkeleton className="h-6 w-44" />
          </div>
          <AppSkeleton className="mt-6 mx-4 h-14" />
        </section>
      </div>
      <footer className="editor-status">
        <AppSkeleton className="h-3 w-28" />
      </footer>
    </main>
  );
}

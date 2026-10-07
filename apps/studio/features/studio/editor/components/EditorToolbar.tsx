"use client";
import Link from "next/link";
import { ArrowLeft, Settings2, CloudCheck, Download } from "lucide-react";
import { UserDropdown } from "@/components/common/UserDropdown";
import { AppButton, AppHeader, AppPopover } from "@blynta/ui";
import { AppInput } from "@blynta/ui";
import { AppTooltip } from "@blynta/ui";
import { useEditor } from "../hooks/useEditor";
export function EditorToolbar({ onExport }: { onExport: () => void }) {
  const e = useEditor();
  return (
    <AppHeader className="flex h-auto min-h-12 shrink-0 flex-wrap items-center gap-2 rounded-xl bg-card px-3 ring-1 ring-border/60 py-1.5 md:h-12 md:flex-nowrap">
      <AppTooltip content="Back to projects">
        <AppButton
          nativeButton={false}
          role="link"
          render={<Link href="/dashboard" />}
          variant="ghost"
          size="icon"
          aria-label="Back to projects"
        >
          <ArrowLeft />
        </AppButton>
      </AppTooltip>
      <AppInput
        aria-label="Project name"
        className="h-8 border-transparent bg-transparent px-2 text-sm font-medium shadow-none hover:bg-muted/40 focus-visible:border-ring dark:bg-transparent dark:hover:bg-muted/40"
        title="Rename project"
        wrapperClassName="min-w-20 flex-1 max-w-80"
        value={e.doc.name}
        maxLength={100}
        onChange={(v) => e.edit((d) => ({ ...d, name: v.target.value }))}
      />
      <span
        className="ml-auto hidden lg:flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
        role="status"
      >
        <CloudCheck className="h-4 w-4" />
        {e.saveState}
      </span>
      {e.saveState.startsWith("Save failed") && (
        <AppButton
          size="xs"
          variant="outline"
          className="editor-save-retry"
          onClick={() => {
            void e.retrySave().catch(() => {});
          }}
        >
          Retry save
        </AppButton>
      )}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <AppButton
          id="editor-ai-launcher"
          variant="ghost"
          className={`h-8 ${e.aiOpen ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
          size="sm"
          aria-label="Open Blynta AI chat"
          aria-controls="editor-ai-chat"
          aria-expanded={e.aiOpen}
          onClick={() => {
            e.setAiOpen(!e.aiOpen);
            if (window.innerWidth < 1100) e.setContextOpen(false);
          }}
        >
          Blynta AI
        </AppButton>
        <span className="mx-1 h-5 w-px bg-border/60" aria-hidden="true" />
        <AppButton
          size="default"
          aria-label="Export project"
          onClick={onExport}
        >
          <Download />
          <span className="hidden sm:inline">Export</span>
        </AppButton>
        <AppPopover
          title="Project settings"
          trigger={
            <AppButton
              variant="ghost"
              size="icon"
              aria-label="Project settings"
            >
              <Settings2 />
            </AppButton>
          }
        >
          <dl className="grid grid-cols-2 gap-3 p-4 text-xs min-w-60">
            <dt className="text-muted-foreground">Duration</dt>
            <dd>{e.duration.toFixed(1)} sec</dd>
            <dt className="text-muted-foreground">Timeline clips</dt>
            <dd>{e.doc.clips.length}</dd>
            <dt className="text-muted-foreground">Media assets</dt>
            <dd>{e.doc.assets.length}</dd>
            <dt className="text-muted-foreground">Preview frame rate</dt>
            <dd>30 fps</dd>
          </dl>
          <div className="border-t border-border px-4 py-3">
            <AppButton
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={() => {
                e.setAiOpen(false);
                e.setInspectorOpen(true);
                if (window.innerWidth < 1100) e.setContextOpen(false);
              }}
            >
              Open properties
            </AppButton>
          </div>
        </AppPopover>
        <div className="ml-1 border-l border-border/60 pl-3">
          <UserDropdown />
        </div>
      </div>
    </AppHeader>
  );
}

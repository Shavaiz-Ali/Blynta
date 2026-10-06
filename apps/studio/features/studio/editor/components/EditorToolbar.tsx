"use client";
import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  Settings2,
  CloudCheck,
  Download,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightOpen,
  PanelRightClose,
} from "lucide-react";
import { UserDropdown } from "@/components/common/UserDropdown";
import { AppButton, AppHeader, AppPopover } from "@blynta/ui";
import { AppInput } from "@blynta/ui";
import { AppTooltip } from "@blynta/ui";
import { useEditor } from "../hooks/useEditor";
export function EditorToolbar({ onExport }: { onExport: () => void }) {
  const e = useEditor();
  return (
    <AppHeader className="editor-toolbar col-start-2 row-start-1 grid md:flex h-auto md:h-14">
      <AppTooltip content="Back to projects">
        <AppButton
          nativeButton={false}
          role="link"
          render={<Link href="/dashboard" />}
          variant="ghost"
          size="icon-sm"
          aria-label="Back to projects"
        >
          <ArrowLeft />
        </AppButton>
      </AppTooltip>
      <AppInput
        aria-label="Project name"
        className="bg-background/80"
        wrapperClassName="project-name min-w-0 flex-1 md:max-w-md"
        value={e.doc.name}
        maxLength={100}
        onChange={(v) => e.edit((d) => ({ ...d, name: v.target.value }))}
      />
      <span
        className="hidden xl:flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
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
      <div className="editor-actions ml-auto flex items-center gap-1.5">
        <AppTooltip content="Toggle media panel">
          <AppButton
            variant="ghost"
            size="icon-sm"
            aria-label="Toggle media panel"
            aria-pressed={e.contextOpen}
            onClick={() => {
              if (window.innerWidth < 1100) {
                e.setAiOpen(false);
                e.setInspectorOpen(false);
              }
              e.setContextOpen(!e.contextOpen);
            }}
          >
            {e.contextOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
          </AppButton>
        </AppTooltip>
        <AppTooltip content="Toggle properties panel">
          <AppButton
            variant="ghost"
            size="icon-sm"
            aria-label="Toggle properties panel"
            aria-pressed={e.inspectorOpen && !e.aiOpen}
            onClick={() => {
              if (window.innerWidth < 1100) e.setContextOpen(false);
              if (e.aiOpen) {
                e.setAiOpen(false);
                e.setInspectorOpen(true);
              } else e.setInspectorOpen(!e.inspectorOpen);
            }}
          >
            {e.inspectorOpen ? <PanelRightClose /> : <PanelRightOpen />}
          </AppButton>
        </AppTooltip>
        <AppButton
          id="editor-ai-launcher"
          variant={e.aiOpen ? "secondary" : "outline"}
          size="sm"
          aria-label="Open Blynta AI chat"
          aria-controls="editor-ai-chat"
          aria-expanded={e.aiOpen}
          onClick={() => {
            e.setAiOpen(!e.aiOpen);
            if (window.innerWidth < 1100) e.setContextOpen(false);
          }}
        >
          <Sparkles />
          <span className="hidden sm:inline">Blynta AI</span>
        </AppButton>
        <AppButton size="sm" aria-label="Export project" onClick={onExport}>
          <Download />
          <span className="hidden sm:inline">Export</span>
        </AppButton>
        <AppPopover
          title="Project settings"
          trigger={
            <AppButton
              variant="ghost"
              size="icon-sm"
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
        </AppPopover>
        <UserDropdown />
      </div>
    </AppHeader>
  );
}

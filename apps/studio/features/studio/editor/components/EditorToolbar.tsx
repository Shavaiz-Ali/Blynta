"use client";
import Link from "next/link";
import {
  ArrowLeft,
  CloudCheck,
  Undo2,
  Redo2,
  Download,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightOpen,
  PanelRightClose,
} from "lucide-react";
import { StudioLogo } from "@/components/common/StudioLogo";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { UserDropdown } from "@/components/common/UserDropdown";
import { AppButton, AppHeader } from "@blynta/ui";
import { AppInput } from "@blynta/ui";
import { AppTooltip } from "@/components/common/AppTooltip";
import { useEditor } from "../hooks/useEditor";
export function EditorToolbar({ onExport }: { onExport: () => void }) {
  const e = useEditor();
  return (
    <AppHeader className="editor-toolbar grid md:flex h-auto md:h-14">
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
      <span className="editor-brand">
        <StudioLogo />
      </span>
      <span className="h-5 border-l" />
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
              if (window.innerWidth < 1360) {
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
            aria-pressed={e.inspectorOpen}
            onClick={() => {
              if (window.innerWidth < 1360) e.setContextOpen(false);
              if (e.aiOpen) {
                e.setAiOpen(false);
                e.setInspectorOpen(true);
              } else e.setInspectorOpen(!e.inspectorOpen);
            }}
          >
            {e.inspectorOpen ? <PanelRightClose /> : <PanelRightOpen />}
          </AppButton>
        </AppTooltip>
        <AppTooltip content="Undo · Ctrl/⌘ Z">
          <AppButton
            variant="ghost"
            size="icon-sm"
            aria-label="Undo"
            disabled={!e.history.past.length}
            onClick={e.undo}
          >
            <Undo2 />
          </AppButton>
        </AppTooltip>
        <AppTooltip content="Redo · Ctrl/⌘ Shift Z">
          <AppButton
            variant="ghost"
            size="icon-sm"
            aria-label="Redo"
            disabled={!e.history.future.length}
            onClick={e.redo}
          >
            <Redo2 />
          </AppButton>
        </AppTooltip>
        <span className="h-5 border-l mx-1" />
        <AppButton size="sm" aria-label="Export project" onClick={onExport}>
          <Download />
          <span className="hidden sm:inline">Export</span>
        </AppButton>
        <ThemeToggle />
        <UserDropdown />
      </div>
    </AppHeader>
  );
}

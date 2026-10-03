"use client";
import Link from "next/link";
import {
  ArrowLeft,
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
import { AppButton } from "@blynta/ui";
import { AppInput } from "@blynta/ui";
import { AppTooltip } from "@/components/common/AppTooltip";
import { useEditor } from "../hooks/useEditor";
export function EditorToolbar({ onExport }: { onExport: () => void }) {
  const e = useEditor();
  return (
    <header className="editor-toolbar">
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
        size="sm"
        wrapperClassName="project-name"
        value={e.doc.name}
        maxLength={100}
        onChange={(v) => e.edit((d) => ({ ...d, name: v.target.value }))}
      />
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
              if (window.innerWidth < 1180) {
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
              if (window.innerWidth < 1180) e.setContextOpen(false);
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
    </header>
  );
}

"use client";
import { useState } from "react";
import { X, Sparkles, Film, Check, ArrowUpRight } from "lucide-react";
import { AppButton, AppTabs, AppScrollArea } from "@blynta/ui";
import { useEditor } from "../hooks/useEditor";
import {
  InspectorPanel,
  type InspectorSection,
} from "../inspector/InspectorPanel";
import { AIPanel } from "../ai/AIPanel";

function ClipInspector() {
  const e = useEditor();
  const [section, setSection] = useState<InspectorSection>("basic");
  const clip = e.selected!;
  const tabs = [
    {
      value: "basic",
      label:
        clip.kind === "audio"
          ? "Audio"
          : clip.kind === "text"
            ? "Text"
            : clip.kind === "image"
              ? "Image"
              : "Video",
    },
    ...(clip.kind === "video" ? [{ value: "audio", label: "Audio" }] : []),
    { value: "timing", label: "Timing" },
  ];
  return (
    <div className="inspector-task" hidden={e.aiOpen || !e.inspectorOpen}>
      <div className="workspace-panel-heading">
        <div className="min-w-0">
          <h2>Clip inspector</h2>
          <p className="truncate">{clip.name}</p>
        </div>
        <AppButton
          size="icon-sm"
          variant="ghost"
          aria-label="Close properties panel"
          onClick={() => e.setInspectorOpen(false)}
        >
          <X />
        </AppButton>
      </div>
      <AppTabs
        variant="default"
        size="default"
        className="inspector-tabs"
        value={section}
        onValueChange={(value) => setSection(value as InspectorSection)}
        tabs={tabs}
      />
      <InspectorPanel section={section} />
    </div>
  );
}
function ProjectSettings({ onExport }: { onExport: () => void }) {
  const e = useEditor();
  return (
    <div
      className="flex min-h-0 flex-1 flex-col [&[hidden]]:hidden"
      hidden={e.aiOpen || !!e.selected}
    >
      <div className="workspace-panel-heading">
        <div>
          <h2>Your project</h2>
          <p>Set the scene for your next story</p>
        </div>
        <AppButton
          size="icon-sm"
          variant="ghost"
          aria-label="Close project settings"
          onClick={() => e.setInspectorOpen(false)}
        >
          <X />
        </AppButton>
      </div>
      <AppScrollArea className="min-h-0 flex-1">
        <div className="grid gap-5 p-4">
          <div className="grid gap-3 border border-border bg-background p-4">
            <span className="text-primary">
              <Sparkles size={20} />
            </span>
            <h3 className="text-base font-semibold leading-snug">
              A little direction.
              <br />A whole new story.
            </h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Describe your edit and let Blynta AI help bring it to life.
            </p>
            <AppButton
              className="w-full"
              size="sm"
              onClick={() => e.setAiOpen(true)}
            >
              <Sparkles />
              Edit with Blynta AI
              <ArrowUpRight />
            </AppButton>
          </div>
          <fieldset className="min-w-0">
            <legend className="mb-3 text-xs font-medium">Canvas format</legend>
            <div className="grid grid-cols-4 gap-1.5">
              {["16:9", "9:16", "1:1", "4:5"].map((ratio) => (
                <AppButton
                  key={ratio}
                  variant={e.doc.ratio === ratio ? "secondary" : "outline"}
                  className="relative h-18 px-1 text-xs"
                  contentClassName="flex-col gap-2"
                  aria-label={`Set canvas to ${ratio}`}
                  aria-pressed={e.doc.ratio === ratio}
                  onClick={() =>
                    e.edit((doc) => ({
                      ...doc,
                      ratio: ratio as typeof doc.ratio,
                    }))
                  }
                >
                  <span
                    className={`block h-5 max-w-8 border border-current ${ratio === "16:9" ? "aspect-video" : ratio === "9:16" ? "aspect-[9/16]" : ratio === "1:1" ? "aspect-square" : "aspect-[4/5]"}`}
                  />
                  <span>{ratio}</span>
                  {e.doc.ratio === ratio && (
                    <Check className="absolute top-1 right-1 size-3" />
                  )}
                </AppButton>
              ))}
            </div>
          </fieldset>
          <div>
            <span className="flex items-center gap-2 text-xs font-medium">
              <Film size={14} />
              Project overview
            </span>
            <dl className="mt-3 grid grid-cols-[1fr_auto] gap-2 text-xs">
              <dt className="text-muted-foreground">Clips</dt>
              <dd>{e.doc.clips.length}</dd>
              <dt className="text-muted-foreground">Media files</dt>
              <dd>{e.doc.assets.length}</dd>
              <dt className="text-muted-foreground">Preview</dt>
              <dd>30 fps</dd>
            </dl>
          </div>
          <AppButton
            variant="outline"
            className="w-full"
            size="sm"
            onClick={onExport}
          >
            Export settings
            <ArrowUpRight />
          </AppButton>
        </div>
      </AppScrollArea>
    </div>
  );
}
export function EditorTaskPanel({ onExport }: { onExport: () => void }) {
  const e = useEditor();
  return (
    <div
      className="right-workspace border border-border"
      hidden={!e.aiOpen && !e.inspectorOpen}
      aria-label={
        e.aiOpen
          ? "Blynta AI workspace"
          : e.selected
            ? "Selected clip properties"
            : "Project settings"
      }
    >
      {e.selected && <ClipInspector key={e.selected.kind} />}
      <ProjectSettings onExport={onExport} />
      {/* Keep chat mounted so closing the dock retains the proposal history. */}
      <AIPanel />
    </div>
  );
}

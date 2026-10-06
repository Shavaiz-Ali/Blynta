"use client";
import { useState } from "react";
import { X } from "lucide-react";
import { AppButton, AppTabs } from "@blynta/ui";
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
export function EditorTaskPanel() {
  const e = useEditor();
  return (
    <div
      className="right-workspace"
      hidden={!e.aiOpen && (!e.selected || !e.inspectorOpen)}
      aria-label={e.aiOpen ? "Blynta AI workspace" : "Selected clip properties"}
    >
      {e.selected && <ClipInspector key={e.selected.kind} />}
      {/* Keep chat mounted so closing the dock retains the proposal history. */}
      <AIPanel />
    </div>
  );
}

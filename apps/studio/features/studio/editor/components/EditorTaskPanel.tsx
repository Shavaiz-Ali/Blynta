"use client";
import { useState } from "react";
import { SlidersHorizontal, Music2, Timer, Sparkles, X } from "lucide-react";
import { AppButton, AppSidebarItem } from "@blynta/ui";
import { useEditor } from "../hooks/useEditor";
import {
  InspectorPanel,
  type InspectorSection,
} from "../inspector/InspectorPanel";
import { AIPanel } from "../ai/AIPanel";

const sections = [
  { id: "basic", label: "Basic", icon: SlidersHorizontal },
  { id: "audio", label: "Audio", icon: Music2 },
  { id: "timing", label: "Timing", icon: Timer },
] as const;

export function EditorTaskPanel() {
  const e = useEditor();
  const [section, setSection] = useState<InspectorSection>("basic");
  return (
    <>
      <div className="right-workspace" hidden={!e.inspectorOpen && !e.aiOpen}>
        <div className="inspector-task" hidden={e.aiOpen || !e.inspectorOpen}>
          <div className="workspace-panel-heading">
            <div>
              <h2>{sections.find((item) => item.id === section)?.label}</h2>
              <p>{e.selected ? "Selected clip" : "Project settings"}</p>
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
          <InspectorPanel section={section} />
        </div>
        <AIPanel />
      </div>
      <nav className="property-rail" aria-label="Clip and project controls">
        {sections.map((item) => (
          <AppSidebarItem
            key={item.id}
            label={item.label}
            icon={<item.icon />}
            rail
            active={!e.aiOpen && e.inspectorOpen && section === item.id}
            className="editor-property-item flex-row md:flex-col min-h-8 md:min-h-14 w-auto md:w-full"
            onClick={() => {
              setSection(item.id);
              e.setAiOpen(false);
              e.setInspectorOpen(true);
              if (window.innerWidth < 1360) e.setContextOpen(false);
            }}
          />
        ))}
        <div className="property-rail-divider" />
        <AppSidebarItem
          id="editor-ai-launcher"
          label="AI edit"
          icon={<Sparkles />}
          rail
          active={e.aiOpen}
          className="editor-property-item flex-row md:flex-col min-h-8 md:min-h-14 w-auto md:w-full"
          aria-label="Open Blynta AI chat"
          aria-controls="editor-ai-chat"
          aria-expanded={e.aiOpen}
          onClick={() => {
            e.setAiOpen(!e.aiOpen);
            if (window.innerWidth < 1360) e.setContextOpen(false);
          }}
        />
      </nav>
    </>
  );
}

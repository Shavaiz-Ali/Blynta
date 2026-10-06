"use client";
import { RotateCcw } from "lucide-react";
import { AppDisclosure } from "@blynta/ui";
import { AppInput } from "@blynta/ui";
import { AppTextarea } from "@blynta/ui";
import { AppSelect } from "@blynta/ui";
import { AppButton } from "@blynta/ui";
import { AppScrollArea } from "@blynta/ui";
import { AppSlider } from "@blynta/ui";
import { useEditor } from "../hooks/useEditor";
import type { Clip } from "../../types";
function NumberField({
  label,
  field,
  min,
  max,
  step = 1,
}: {
  label: string;
  field: keyof Clip;
  min: number;
  max: number;
  step?: number;
}) {
  const e = useEditor();
  if (!e.selected) return null;
  return (
    <AppInput
      label={label}
      size="default"
      type="number"
      min={min}
      max={max}
      step={step}
      value={e.selected[field] as number}
      onChange={(v) => {
        if (v.target.value === "") return;
        const value = Number(v.target.value);
        if (Number.isFinite(value))
          e.patch(e.selected!.id, {
            [field]: Math.max(min, Math.min(max, value)),
          });
      }}
    />
  );
}
function TransformInspector() {
  const e = useEditor();
  return (
    <>
      <AppDisclosure title="Transform">
        <div className="flex justify-end mb-2">
          <AppButton
            size="icon-xs"
            variant="ghost"
            aria-label="Reset transform"
            title="Reset transform"
            onClick={() =>
              e.selected &&
              e.patch(e.selected.id, {
                x: 0,
                y: 0,
                scale: 100,
                rotation: 0,
                opacity: 100,
              })
            }
          >
            <RotateCcw />
          </AppButton>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Position X" field="x" min={-1000} max={1000} />
          <NumberField label="Position Y" field="y" min={-1000} max={1000} />
          <NumberField label="Scale %" field="scale" min={10} max={300} />
          <NumberField
            label="Rotation °"
            field="rotation"
            min={-180}
            max={180}
          />
        </div>
        <div className="mt-4">
          <p className="flex justify-between text-xs mb-3">
            Opacity
            <span className="text-muted-foreground">
              {e.selected!.opacity}%
            </span>
          </p>
          <AppSlider
            label="Clip opacity"
            value={e.selected!.opacity}
            onValueChange={(v) => e.patch(e.selected!.id, { opacity: v })}
          />
        </div>
      </AppDisclosure>
    </>
  );
}
function VideoInspector() {
  const e = useEditor();
  return (
    <>
      <TransformInspector />
      <AppDisclosure title="Frame fit">
        <AppSelect
          label="Crop & fit"
          size="default"
          wrapperClassName="mt-4"
          value={e.selected!.fit}
          onValueChange={(v) =>
            e.patch(e.selected!.id, { fit: v as "contain" | "cover" })
          }
          options={[
            { value: "contain", label: "Fit entire frame" },
            { value: "cover", label: "Fill / crop edges" },
          ]}
        />
      </AppDisclosure>
    </>
  );
}
function TextInspector() {
  const e = useEditor();
  const clip = e.selected!;
  return (
    <>
      <AppTextarea
        label="Text content"
        rows={3}
        value={clip.name}
        onChange={(v) => e.patch(clip.id, { name: v.target.value })}
      />
      <AppDisclosure title="Font & style">
        <AppSelect
          label="Font"
          size="default"
          value={clip.fontFamily ?? "Arial"}
          onValueChange={(fontFamily) => e.patch(clip.id, { fontFamily })}
          options={[
            { value: "Arial", label: "Sans" },
            { value: "Georgia", label: "Serif" },
            { value: "Courier New", label: "Mono" },
          ]}
        />
        <div className="grid grid-cols-2 gap-3 mt-3">
          <NumberField label="Size" field="fontSize" min={12} max={96} />
          <AppSelect
            label="Weight"
            size="default"
            value={String(clip.fontWeight ?? 700)}
            onValueChange={(v) => e.patch(clip.id, { fontWeight: Number(v) })}
            options={[
              { value: "400", label: "Regular" },
              { value: "700", label: "Bold" },
            ]}
          />
        </div>
        <AppSelect
          label="Alignment"
          wrapperClassName="mt-3"
          size="default"
          value={clip.textAlign ?? "center"}
          onValueChange={(v) =>
            e.patch(clip.id, { textAlign: v as "left" | "center" | "right" })
          }
          options={[
            { value: "left", label: "Left" },
            { value: "center", label: "Center" },
            { value: "right", label: "Right" },
          ]}
        />
        <div className="grid grid-cols-2 gap-3 mt-3">
          <AppInput
            label="Color"
            type="color"
            size="default"
            value={clip.color}
            onChange={(v) => e.patch(clip.id, { color: v.target.value })}
          />
        </div>
      </AppDisclosure>
      <TransformInspector />
    </>
  );
}
function AudioInspector() {
  return (
    <>
      <AppDisclosure title="Audio">
        <NumberField label="Volume %" field="volume" min={0} max={100} />
        <div className="grid grid-cols-2 gap-3 mt-3">
          <NumberField
            label="Fade in · s"
            field="fadeIn"
            min={0}
            max={10}
            step={0.5}
          />
          <NumberField
            label="Fade out · s"
            field="fadeOut"
            min={0}
            max={10}
            step={0.5}
          />
        </div>
      </AppDisclosure>
    </>
  );
}
const inspectors = {
  video: VideoInspector,
  image: VideoInspector,
  text: TextInspector,
  audio: AudioInspector,
};
export type InspectorSection = "basic" | "audio" | "timing";
export function InspectorPanel({
  section = "basic",
}: {
  section?: InspectorSection;
}) {
  const e = useEditor();
  const Inspector = e.selected ? inspectors[e.selected.kind] : null;
  return (
    <aside className="inspector-panel">
      <AppScrollArea className="flex-1">
        <div className="inspector-body">
          {e.selected && Inspector ? (
            <>
              <fieldset
                disabled={
                  !!e.doc.tracks.find((t) => t.id === e.selected?.trackId)
                    ?.locked
                }
              >
                {section === "basic" && <Inspector />}
                {section === "audio" &&
                  (e.selected.kind === "audio" ||
                  e.selected.kind === "video" ? (
                    <AudioInspector />
                  ) : (
                    <p className="inspector-guidance">
                      This clip has no audio. Select a video or audio clip to
                      adjust volume and fades.
                    </p>
                  ))}
                {section === "timing" && (
                  <AppDisclosure title="Timing">
                    <NumberField
                      label="Start · seconds"
                      field="start"
                      min={0}
                      max={3600}
                      step={0.1}
                    />
                    {(e.selected.kind === "video" ||
                      e.selected.kind === "audio") && (
                      <div className="mt-4">
                        <NumberField
                          label="Playback speed"
                          field="speed"
                          min={0.25}
                          max={2}
                          step={0.25}
                        />
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-3">
                      Duration {e.selected.duration.toFixed(1)}s<br />
                      Drag timeline handles to trim.
                    </p>
                  </AppDisclosure>
                )}
              </fieldset>
              {e.doc.tracks.find((t) => t.id === e.selected?.trackId)
                ?.locked && (
                <p className="text-xs text-muted-foreground mt-3">
                  Track locked. Unlock it in the timeline to edit.
                </p>
              )}
            </>
          ) : (
            <p className="inspector-guidance">
              Select a timeline clip to edit its properties.
            </p>
          )}
        </div>
      </AppScrollArea>
    </aside>
  );
}

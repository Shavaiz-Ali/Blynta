"use client";
import { useRef, useState } from "react";
import {
  Film,
  Type,
  Music2,
  Captions,
  Layers,
  WandSparkles,
  Palette,
  Upload,
  Search,
  PanelLeftClose,
} from "lucide-react";
import { AppButton } from "@blynta/ui";
import { AppFileInput } from "@/components/common/AppFileInput";
import { AppInput } from "@blynta/ui";
import { AppTooltip } from "@/components/common/AppTooltip";
import { AppScrollArea } from "@/components/common/AppScrollArea";
import { useEditor } from "../hooks/useEditor";
import { useMediaUpload } from "./useMediaUpload";
import { MediaItem } from "./MediaItem";
import type { Asset } from "../../types";
const tools = [
  { name: "Media", icon: Film },
  { name: "Text", icon: Type },
  { name: "Audio", icon: Music2 },
  { name: "Captions", icon: Captions },
  { name: "Transitions", icon: Layers },
  { name: "Effects", icon: WandSparkles },
  { name: "Brand", icon: Palette },
];
function assetGroup(asset: Asset) {
  return (
    asset.sourceGroup ??
    (asset.kind === "audio"
      ? "Audio"
      : asset.kind === "image"
        ? "Images"
        : asset.origin === "Upload"
          ? "Uploads"
          : asset.id === "main"
            ? "Original source"
            : "Generated clips")
  );
}
export function MediaPanel() {
  const e = useEditor();
  const { upload, busy, error } = useMediaUpload();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [source, setSource] = useState("all");
  const fileRef = useRef<HTMLInputElement>(null);
  const assets = e.doc.assets.filter(
    (a) =>
      a.kind !== "text" &&
      (e.tool !== "Audio" || a.kind === "audio") &&
      (e.tool === "Audio" ||
        source === "all" ||
        (source === "generated"
          ? assetGroup(a) === "Generated clips"
          : a.origin === "Upload" || assetGroup(a) === "Uploads")) &&
      (e.tool === "Audio" || filter === "all" || a.kind === filter) &&
      a.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <aside className="media-area">
      <nav className="tool-rail" aria-label="Editor tools">
        {tools.map((t) => (
          <AppTooltip key={t.name} content={t.name}>
            <AppButton
              variant={e.tool === t.name ? "secondary" : "ghost"}
              className={`rail-button ${e.tool === t.name ? "active" : ""}`}
              aria-label={t.name}
              aria-pressed={e.tool === t.name}
              onClick={() => {
                if (window.matchMedia("(max-width: 1179px)").matches) {
                  e.setAiOpen(false);
                  e.setInspectorOpen(false);
                }
                e.setContextOpen(e.tool === t.name ? !e.contextOpen : true);
                e.setTool(t.name);
              }}
            >
              <t.icon size={18} />
              <span>{t.name}</span>
            </AppButton>
          </AppTooltip>
        ))}
      </nav>
      <div className="tool-panel">
        <div className="panel-heading">
          <h2>{e.tool === "Media" ? "Media library" : e.tool}</h2>
          <AppButton
            variant="ghost"
            size="icon-xs"
            title="Collapse contextual panel"
            aria-label="Collapse contextual panel"
            onClick={() => e.setContextOpen(false)}
          >
            <PanelLeftClose />
          </AppButton>
        </div>
        <AppScrollArea className="flex-1">
          <div className="media-panel-body">
            {e.tool === "Media" || e.tool === "Audio" ? (
              <>
                <AppInput
                  aria-label="Search media"
                  prefixIcon={<Search size={14} />}
                  size="sm"
                  value={search}
                  onChange={(v) => setSearch(v.target.value)}
                  placeholder="Search media & files"
                />
                <AppFileInput
                  ref={fileRef}
                  label="Upload editor media"
                  disabled={busy}
                  onFile={upload}
                />
                {busy && (
                  <p
                    className="text-xs text-muted-foreground mt-3"
                    role="status"
                  >
                    Uploading and processing media…
                  </p>
                )}
                {e.tool === "Media" && (
                  <div
                    className="media-source-tabs"
                    role="group"
                    aria-label="Media sources"
                  >
                    {[
                      { id: "all", label: "Library" },
                      { id: "uploads", label: "Uploads" },
                      { id: "generated", label: "Generated" },
                    ].map((tab) => (
                      <AppButton
                        key={tab.id}
                        size="sm"
                        variant="ghost"
                        className={source === tab.id ? "active" : ""}
                        aria-pressed={source === tab.id}
                        onClick={() => setSource(tab.id)}
                      >
                        {tab.label}
                      </AppButton>
                    ))}
                  </div>
                )}
                {e.tool === "Media" && (
                  <div
                    className="flex gap-1 mt-3"
                    role="group"
                    aria-label="Media filters"
                  >
                    {["all", "video", "image", "audio"].map((kind) => (
                      <AppButton
                        key={kind}
                        size="xs"
                        variant={filter === kind ? "secondary" : "ghost"}
                        onClick={() => setFilter(kind)}
                        aria-pressed={filter === kind}
                      >
                        {kind === "all"
                          ? "All"
                          : kind === "image"
                            ? "Images"
                            : kind === "video"
                              ? "Video"
                              : "Audio"}
                      </AppButton>
                    ))}
                  </div>
                )}
                {(error || e.mediaError) && (
                  <p role="alert" className="text-xs text-destructive mt-3">
                    {error || e.mediaError}
                  </p>
                )}
                {e.mediaStatus.some(
                  (a) =>
                    a.status === "ready" &&
                    !e.doc.assets.some((saved) => saved.id === a.id),
                ) && (
                  <section className="mt-4">
                    <h3 className="media-group-heading">
                      Available cloud media
                    </h3>
                    {e.mediaStatus
                      .filter(
                        (a) =>
                          a.status === "ready" &&
                          !e.doc.assets.some((saved) => saved.id === a.id),
                      )
                      .map((a) => (
                        <AppButton
                          key={a.id}
                          size="sm"
                          variant="outline"
                          className="w-full mt-2 truncate"
                          onClick={() =>
                            e.edit((d) => ({ ...d, assets: [...d.assets, a] }))
                          }
                        >
                          Add {a.name} to library
                        </AppButton>
                      ))}
                  </section>
                )}
                <div className="media-library-grid">
                  <AppButton
                    className="media-upload-tile"
                    variant="outline"
                    isLoading={busy}
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload size={24} />
                    <span>Upload media</span>
                  </AppButton>
                  {assets.map((asset) => (
                    <MediaItem key={asset.id} asset={asset} />
                  ))}
                </div>
                {!assets.length && (
                  <p className="mt-5 text-xs text-muted-foreground">
                    {search
                      ? "No media matches your search."
                      : "Upload a file to begin."}
                  </p>
                )}
              </>
            ) : e.tool === "Text" ? (
              <>
                <p className="text-xs text-muted-foreground mb-4">
                  Add editable text to the timeline.
                </p>
                {["Heading", "Body text", "Caption"].map((name, i) => (
                  <AppButton
                    key={name}
                    variant="outline"
                    className="w-full mb-2"
                    onClick={() =>
                      e.add({
                        id: crypto.randomUUID(),
                        name: i === 0 ? "Your heading" : "Your text",
                        kind: "text",
                        duration: 5,
                        origin: "Text",
                      })
                    }
                  >
                    <Type />
                    {name}
                  </AppButton>
                ))}
              </>
            ) : e.tool === "Captions" ? (
              <>
                <h3 className="text-sm font-medium">Editable captions</h3>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  Generate captions from your source transcript. Blynta
                  processes uploaded speech when a transcript is needed.
                </p>
                <AppButton
                  className="mt-4 w-full"
                  disabled={!e.duration}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (window.innerWidth < 1180) e.setContextOpen(false);
                    e.setAiOpen(true);
                  }}
                >
                  Open caption agent
                </AppButton>
              </>
            ) : e.tool === "Transitions" || e.tool === "Effects" ? (
              <>
                <p className="text-xs text-muted-foreground mb-4">
                  {e.selected && e.selected.kind !== "audio"
                    ? "Apply to the selected visual clip."
                    : "Select a video, image, or text clip to edit."}
                </p>
                {(e.tool === "Transitions"
                  ? [
                      { label: "Fade in · 1 second", patch: { fadeIn: 1 } },
                      { label: "Fade out · 1 second", patch: { fadeOut: 1 } },
                      {
                        label: "Remove fades",
                        patch: { fadeIn: 0, fadeOut: 0 },
                      },
                    ]
                  : [
                      { label: "Half opacity", patch: { opacity: 50 } },
                      { label: "Full opacity", patch: { opacity: 100 } },
                      { label: "Zoom to 125%", patch: { scale: 125 } },
                    ]
                ).map((preset) => (
                  <AppButton
                    key={preset.label}
                    className="w-full mb-2"
                    variant="outline"
                    size="sm"
                    disabled={
                      !e.selected ||
                      e.selected.kind === "audio" ||
                      !!e.doc.tracks.find((t) => t.id === e.selected?.trackId)
                        ?.locked
                    }
                    onClick={() =>
                      e.selected && e.patch(e.selected.id, preset.patch)
                    }
                  >
                    {preset.label}
                  </AppButton>
                ))}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Brand presets are not available yet. Add a logo through Media
                and use the text inspector for fonts and colors.
              </p>
            )}
          </div>
        </AppScrollArea>
      </div>
    </aside>
  );
}

"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { StudioLogo } from "@/components/common/StudioLogo";
import { ThemeToggle } from "@/components/common/ThemeToggle";
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
import { AppButton, AppSidebarItem, AppTabs } from "@blynta/ui";
import { AppFileInput } from "@blynta/ui";
import { supportedMedia } from "@/features/studio/editor/media/supported-media";
import { AppInput } from "@blynta/ui";
import { AppTooltip } from "@blynta/ui";
import { AppScrollArea } from "@blynta/ui";
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
export function EditorToolRail() {
  const e = useEditor();
  return (
    <nav
      className="flex w-14 shrink-0 flex-col gap-1 overflow-y-auto rounded-xl border border-sidebar-border bg-sidebar text-sidebar-foreground px-1 py-3 md:w-[72px]"
      data-editor-rail
      aria-label="Editor tools"
    >
      <Link
        href="/dashboard"
        className="mb-3 grid min-h-10 place-items-center"
        aria-label="Blynta projects"
      >
        <StudioLogo collapsed size={28} />
      </Link>
      {tools.map((t) => (
        <AppTooltip key={t.name} content={t.name}>
          <AppSidebarItem
            label={t.name}
            icon={<t.icon />}
            rail
            active={e.contextOpen && e.tool === t.name}
            className="min-h-14 w-full shrink-0 gap-1 px-1 text-[11px] shadow-none [&>span>svg]:size-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label={t.name}
            aria-pressed={e.contextOpen && e.tool === t.name}
            onClick={() => {
              if (window.matchMedia("(max-width: 1099px)").matches) {
                e.setAiOpen(false);
                e.setInspectorOpen(false);
              }
              e.setContextOpen(e.tool === t.name ? !e.contextOpen : true);
              e.setTool(t.name);
            }}
          />
        </AppTooltip>
      ))}
      <div className="mt-auto grid place-items-center pt-6">
        <ThemeToggle />
      </div>
    </nav>
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
    <aside
      data-project-tools
      aria-label="Project tools"
      className={`col-start-1 row-start-1 min-h-0 min-w-0 overflow-hidden rounded-xl bg-card ring-1 ring-border/60 max-[1099px]:absolute max-[1099px]:inset-y-0 max-[1099px]:left-0 max-[1099px]:z-25 max-[1099px]:w-(--media-width) max-[1099px]:shadow-lg ${e.contextOpen ? "flex" : "hidden"}`}
    >
      <div className="flex min-h-0 min-w-0 w-full flex-col">
        <div className="flex h-14 shrink-0 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Project tools</h2>
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {e.tool}
            </span>
          </div>
          <AppButton
            variant="ghost"
            size="icon"
            title="Collapse contextual panel"
            aria-label="Collapse contextual panel"
            onClick={() => e.setContextOpen(false)}
          >
            <PanelLeftClose />
          </AppButton>
        </div>
        <AppScrollArea className="min-h-0 flex-1">
          <div className="px-4 pb-4">
            {e.tool === "Media" || e.tool === "Audio" ? (
              <>
                <AppInput
                  aria-label="Search media"
                  className="border-transparent bg-muted/50 text-sm shadow-none"
                  size="default"
                  prefixIcon={<Search className="size-4" />}
                  value={search}
                  onChange={(v) => setSearch(v.target.value)}
                  placeholder="Search media & files"
                />
                <AppFileInput
                  accept={supportedMedia}
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
                  <AppTabs
                    variant="line"
                    size="default"
                    listClassName="w-full border-border/50"
                    triggerClassName="min-w-0 flex-1 rounded-none border-0 border-b-2 border-transparent px-1 text-xs data-selected:border-primary data-active:border-primary aria-selected:border-primary"
                    value={source}
                    onValueChange={setSource}
                    className="mt-3"
                    tabs={[
                      { value: "all", label: "Library" },
                      { value: "uploads", label: "Uploads" },
                      { value: "generated", label: "Generated" },
                    ]}
                  />
                )}
                {e.tool === "Media" && (
                  <AppTabs
                    variant="pills"
                    size="default"
                    listClassName="w-full border-0 bg-transparent p-0 shadow-none dark:bg-transparent"
                    triggerClassName="min-w-0 flex-1 border-0 px-1.5 text-xs data-selected:bg-muted data-selected:text-foreground data-active:bg-muted data-active:text-foreground aria-selected:bg-muted aria-selected:text-foreground data-[state=active]:bg-muted data-[state=active]:text-foreground"
                    value={filter}
                    onValueChange={setFilter}
                    className="mt-2"
                    tabs={[
                      { value: "all", label: "All" },
                      { value: "video", label: "Video" },
                      { value: "image", label: "Images" },
                      { value: "audio", label: "Audio" },
                    ]}
                  />
                )}
                <AppButton
                  size="sm"
                  variant="secondary"
                  className="mt-4 h-9 w-full bg-primary/10 text-primary hover:bg-primary/15"
                  icon={<Upload className="h-3.5 w-3.5" />}
                  isLoading={busy}
                  onClick={() => fileRef.current?.click()}
                >
                  Upload media
                </AppButton>
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
                          contentClassName="block truncate"
                          onClick={() =>
                            e.edit((d) => ({ ...d, assets: [...d.assets, a] }))
                          }
                        >
                          Add {a.name} to library
                        </AppButton>
                      ))}
                  </section>
                )}
                <div className="mt-4 grid grid-cols-1 gap-2">
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
                    if (window.innerWidth < 1100) e.setContextOpen(false);
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

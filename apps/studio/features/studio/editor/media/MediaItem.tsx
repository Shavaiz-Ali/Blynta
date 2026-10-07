"use client";
import {
  Film,
  AudioLines,
  Image as ImageIcon,
  MoreHorizontal,
  Plus,
  Trash2,
  Pencil,
  Paperclip,
} from "lucide-react";
import Image from "next/image";
import { formatTime } from "../utils/time";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AppButton, AppMediaCard } from "@blynta/ui";
import { AppDropdown } from "@blynta/ui";
import { AppDialog } from "@blynta/ui";
import { AppFileInput } from "@blynta/ui";
import { supportedMedia } from "@/features/studio/editor/media/supported-media";
import { AppInput } from "@blynta/ui";
import { AppTooltip } from "@blynta/ui";
import { useEditor } from "../hooks/useEditor";
import { uploadMedia } from "../../projects/media";
import type { Asset } from "../../types";
import { assetDragType, mediaUnavailable } from "../utils/timeline";
export function MediaItem({ asset }: { asset: Asset }) {
  const e = useEditor();
  const [rename, setRename] = useState(false);
  const [name, setName] = useState(asset.name);
  const file = useRef<HTMLInputElement>(null);
  const [failedSource, setFailedSource] = useState<string>();
  const unavailable = mediaUnavailable(asset);
  const thumbnail =
    asset.thumbnail || (asset.kind === "image" ? asset.src : undefined);
  const dragging = e.draggedAssetId === asset.id;
  const Icon =
    asset.kind === "audio"
      ? AudioLines
      : asset.kind === "image"
        ? ImageIcon
        : Film;
  return (
    <AppMediaCard
      data-media-asset={asset.id}
      className={`media-item min-w-0 items-stretch rounded-lg border-transparent bg-muted/25 hover:bg-muted/50 ${dragging ? "opacity-50 ring-2 ring-primary cursor-grabbing" : "cursor-grab"} ${e.selected?.assetId === asset.id ? "ring-1 ring-primary/40" : ""}`}
      contentClassName="min-w-0 w-full"
    >
      <AppTooltip
        content={`${asset.name} · ${asset.kind} · ${unavailable || "Click to add, or drag to timeline"}`}
      >
        <AppButton
          variant="ghost"
          draggable={!unavailable}
          aria-disabled={!!unavailable}
          onDragStart={(event) => {
            if (unavailable) {
              event.preventDefault();
              return;
            }
            event.dataTransfer.clearData();
            event.dataTransfer.setData(assetDragType, asset.id);
            event.dataTransfer.effectAllowed = "copy";
            e.setDraggedAssetId(asset.id);
          }}
          onDragEnd={() => e.setDraggedAssetId(null)}
          className="block h-auto w-full cursor-grab justify-start rounded-none p-0 active:cursor-grabbing [&>span]:flex [&>span]:w-full"
          contentClassName="flex w-full items-center text-left"
          onClick={() => {
            if (unavailable) toast.info(unavailable);
            else if (!e.add(asset))
              toast.info(
                "Cannot add media here. Check locked tracks and timeline limits.",
              );
          }}
          aria-label={`Add ${asset.name} to timeline`}
        >
          <span className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded bg-muted text-muted-foreground">
            {thumbnail && failedSource !== thumbnail ? (
              <Image
                src={thumbnail}
                alt=""
                fill
                unoptimized
                draggable={false}
                onError={() => setFailedSource(thumbnail)}
                className="object-cover"
              />
            ) : !thumbnail &&
              asset.src &&
              failedSource !== asset.src &&
              asset.kind === "video" ? (
              <video
                src={asset.src}
                muted
                preload="metadata"
                draggable={false}
                onError={() => setFailedSource(asset.src)}
                className="h-full w-full object-cover"
              />
            ) : (
              <Icon size={18} />
            )}
            {asset.kind === "video" &&
              Number.isFinite(asset.duration) &&
              asset.duration > 0 && (
                <span
                  data-media-duration
                  className="absolute bottom-1.5 right-1.5 rounded bg-card/95 px-1.5 py-0.5 text-[11px] tabular-nums text-foreground ring-1 ring-border/60"
                >
                  {formatTime(asset.duration).slice(0, 5)}
                </span>
              )}
            {unavailable && (
              <span className="absolute inset-x-0 bottom-0 bg-card/95 px-1 py-0.5 text-[10px] text-muted-foreground">
                {asset.status && asset.status !== "ready"
                  ? asset.status
                  : "Unavailable"}
              </span>
            )}
          </span>
        </AppButton>
      </AppTooltip>
      <AppDropdown
        trigger={
          <AppButton
            variant="ghost"
            size="icon-xs"
            aria-label={`Options for ${asset.name}`}
          >
            <MoreHorizontal />
          </AppButton>
        }
        items={[
          {
            label: "Add to timeline",
            disabled: !!unavailable,
            icon: <Plus />,
            onClick: () => e.add(asset),
          },
          {
            label: "Rename media",
            icon: <Pencil />,
            onClick: () => setRename(true),
          },
          ...(asset.origin === "Upload" && !asset.src
            ? [
                {
                  label: "Reattach file",
                  icon: <Paperclip />,
                  onClick: () => file.current?.click(),
                },
              ]
            : []),
          {
            label: "Remove from library",
            icon: <Trash2 />,
            destructive: true,
            separatorBefore: true,
            onClick: () => {
              if (e.doc.clips.some((c) => c.assetId === asset.id)) {
                toast.info(
                  "Remove its clips from the timeline before removing this media.",
                );
                return;
              }
              e.edit((d) => ({
                ...d,
                assets: d.assets.filter((a) => a.id !== asset.id),
              }));
            },
          },
        ]}
      />
      <AppFileInput
        accept={supportedMedia}
        ref={file}
        label={`Reattach ${asset.name}`}
        onFile={async (selected) => {
          try {
            if (!selected) return;
            const replacement = await uploadMedia(e.projectId, selected);
            if (replacement.kind !== asset.kind)
              throw new Error("Choose a replacement with the same media type.");
            e.edit((d) => ({
              ...d,
              assets: d.assets.map((a) =>
                a.id === asset.id ? replacement : a,
              ),
              clips: d.clips.map((c) =>
                c.assetId === asset.id
                  ? {
                      ...c,
                      assetId: replacement.id,
                      offset: 0,
                      duration: Math.min(
                        c.duration,
                        replacement.duration / c.speed,
                      ),
                    }
                  : c,
              ),
            }));
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : "Could not replace this file.",
            );
          }
        }}
      />
      <AppDialog
        open={rename}
        onOpenChange={setRename}
        title="Rename media"
        description="Update the label in the library and timeline."
        footer={
          <AppButton
            disabled={!name.trim()}
            onClick={() => {
              e.edit((d) => ({
                ...d,
                assets: d.assets.map((a) =>
                  a.id === asset.id ? { ...a, name: name.trim() } : a,
                ),
                clips: d.clips.map((c) =>
                  c.assetId === asset.id ? { ...c, name: name.trim() } : c,
                ),
              }));
              setRename(false);
            }}
          >
            Save name
          </AppButton>
        }
      >
        <AppInput
          label="Media name"
          value={name}
          onChange={(v) => setName(v.target.value)}
          autoFocus
        />
      </AppDialog>
    </AppMediaCard>
  );
}

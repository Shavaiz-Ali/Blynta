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
import { AppButton } from "@blynta/ui";
import { AppDropdownMenu } from "@/components/common/AppDropdownMenu";
import { AppDialog } from "@blynta/ui";
import { AppFileInput } from "@/components/common/AppFileInput";
import { AppInput } from "@blynta/ui";
import { AppTooltip } from "@/components/common/AppTooltip";
import { useEditor } from "../hooks/useEditor";
import { uploadMedia } from "../../projects/media";
import type { Asset } from "../../types";
export function MediaItem({ asset }: { asset: Asset }) {
  const e = useEditor();
  const [rename, setRename] = useState(false);
  const [name, setName] = useState(asset.name);
  const file = useRef<HTMLInputElement>(null);
  const Icon =
    asset.kind === "audio"
      ? AudioLines
      : asset.kind === "image"
        ? ImageIcon
        : Film;
  return (
    <div
      draggable
      onDragStart={(v) =>
        v.dataTransfer.setData("application/blynta-asset", asset.id)
      }
      className="media-item"
    >
      <AppTooltip content={`${asset.name} · Click to add, or drag to timeline`}>
        <AppButton
          variant="ghost"
          className="media-item-main"
          onClick={() => e.add(asset)}
          aria-label={`Add ${asset.name} to timeline`}
        >
          <span
            className={`asset-thumbnail ${asset.kind === "audio" ? "audio-thumb" : asset.origin === "Blynta demo" ? "demo-scene" : "bg-muted"}`}
          >
            {asset.thumbnail || (asset.src && asset.kind === "image") ? (
              <Image
                src={asset.thumbnail || asset.src!}
                alt=""
                fill
                unoptimized
                style={{ objectFit: "cover" }}
              />
            ) : asset.src && asset.kind === "video" ? (
              <video
                src={asset.src}
                muted
                preload="metadata"
                className="media-thumbnail-video"
              />
            ) : (
              <Icon size={18} />
            )}
          </span>
          <span className="media-item-label">
            <span className="truncate block text-xs font-medium">
              {asset.name}
            </span>
            <span className="block mt-1 text-[10px] text-muted-foreground">
              {formatTime(asset.duration).slice(0, 5)}
            </span>
          </span>
        </AppButton>
      </AppTooltip>
      <AppDropdownMenu
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
            separator: true,
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
        ref={file}
        label={`Reattach ${asset.name}`}
        onFile={async (selected) => {
          try {
            if (!selected) return;
            const replacement = await uploadMedia(e.projectId, selected);
            if (replacement.kind !== asset.kind) throw new Error('Choose a replacement with the same media type.');
            e.edit((d) => ({
              ...d,
              assets: d.assets.map((a) => a.id === asset.id ? replacement : a),
              clips: d.clips.map((c) => c.assetId === asset.id ? { ...c, assetId: replacement.id, offset: 0, duration: Math.min(c.duration, replacement.duration / c.speed) } : c),
            }));
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not replace this file.");
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
    </div>
  );
}

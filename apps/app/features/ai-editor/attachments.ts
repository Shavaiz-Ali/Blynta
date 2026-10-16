"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { axiosClient } from "@/config/axiosClient";
import { studioError } from "./queries";
import type { StudioAsset } from "./contracts";
export const attachmentFormats: Record<string, string> = {
  png: "image/png",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
};
export const attachmentAccept = Object.keys(attachmentFormats)
  .map((ext) => `.${ext}`)
  .join(",");
export function validateAttachment(file: Pick<File, "name" | "size">) {
  const mime =
    attachmentFormats[file.name.split(".").pop()?.toLowerCase() ?? ""];
  if (
    !mime ||
    !file.size ||
    file.size > 100 * 1024 * 1024 ||
    file.name.length > 200
  )
    throw new Error(
      "Choose a PNG, MP3, WAV, M4A, or OGG file up to 100 MiB (PNG overlays up to 4 megapixels).",
    );
  return mime;
}
export interface Attachment {
  sessionScope?: string;
  key: string;
  name: string;
  status: "selected" | "uploading" | "processing" | "ready" | "failed";
  assetId?: string;
  file?: File;
  error?: string;
  projectId?: string;
}
interface LibraryMedia {
  id: string;
  status: string;
  error?: string;
}
export function useStudioAttachments(sessionScope = "") {
  const client = useQueryClient();
  const [allItems, setItems] = useState<Attachment[]>([]);
  const items = allItems.filter((a) => (a.sessionScope ?? "") === sessionScope);
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  const [error, setError] = useState("");
  const workspace = useRef<Promise<string> | null>(null);
  const active = useRef(new Set<string>());
  const [project, setProject] = useState("");
  const waiting = allItems.some((a) => a.status === "processing");
  const validation = useQuery({
    queryKey: ["ai-editor", "upload-validation", project],
    enabled: !!project && waiting,
    queryFn: async ({ signal }) => {
      const data = (
        await axiosClient.get<LibraryMedia[]>(
          `/studio/projects/${project}/assets`,
          { signal },
        )
      ).data;
      setItems((current) =>
        current.map((a) => {
          if (a.status !== "processing") return a;
          const media = data.find((m) => m.id === a.assetId);
          if (media?.status === "ready" || media?.status === "failed")
            return {
              ...a,
              status: media.status,
              error:
                media.status === "failed"
                  ? "Media validation failed. Check the file and retry."
                  : undefined,
              file: media.status === "ready" ? undefined : a.file,
            };
          return a;
        }),
      );
      void client.invalidateQueries({ queryKey: ["ai-editor", "assets"] });
      return data;
    },
    refetchInterval: waiting ? 2500 : false,
    retry: false,
  });
  async function destination() {
    if (!workspace.current)
      workspace.current = (async () => {
        const folders = await client.fetchQuery({
          queryKey: ["ai-editor", "asset-folders"],
          staleTime: 0,
          queryFn: async () =>
            (
              await axiosClient.get<{ id: string; name: string }[]>(
                "/studio/projects",
              )
            ).data,
        });
        const existing =
          folders.find((p) => p.name === "AI Studio assets") ?? folders[0];
        const id =
          existing?.id ??
          (
            await axiosClient.post<{ id: string }>("/studio/projects", {
              name: "AI Studio assets",
              ratio: "9:16",
            })
          ).data.id;
        setProject(id);
        return id;
      })().catch((e) => {
        workspace.current = null;
        throw e;
      });
    return workspace.current;
  }
  function update(key: string, patch: Partial<Attachment>) {
    setItems((v) => v.map((a) => (a.key === key ? { ...a, ...patch } : a)));
  }
  async function upload(entry: Attachment) {
    if (!entry.file || active.current.has(entry.key)) return;
    active.current.add(entry.key);
    try {
      const mimeType = validateAttachment(entry.file);
      update(entry.key, { status: "uploading", error: undefined });
      const id = await destination();
      const { data } = await axiosClient.post<{
        assetId: string;
        uploadUrl: string;
      }>(`/studio/projects/${id}/assets/upload`, {
        name: entry.name,
        size: entry.file.size,
        mimeType,
      });
      const response = await fetch(data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": mimeType },
        body: entry.file,
      });
      if (!response.ok)
        throw Error("Upload failed. Your file is retained for retry.");
      const completed = (
        await axiosClient.post<{ status: string }>(
          `/studio/projects/${id}/assets/complete`,
          { assetId: data.assetId },
        )
      ).data;
      update(entry.key, {
        assetId: data.assetId,
        projectId: id,
        status: completed.status === "ready" ? "ready" : "processing",
        file: completed.status === "ready" ? undefined : entry.file,
      });
      void client.invalidateQueries({
        queryKey: ["ai-editor", "upload-validation", id],
      });
      void client.invalidateQueries({ queryKey: ["ai-editor", "assets"] });
    } catch (e) {
      update(entry.key, { status: "failed", error: studioError(e) });
    } finally {
      active.current.delete(entry.key);
    }
  }
  function addFiles(files: File[]) {
    setError("");
    const entries: Attachment[] = [];
    for (const file of files) {
      try {
        validateAttachment(file);
        if (itemsRef.current.length + entries.length >= 8)
          throw Error("Attach up to eight files per prompt.");
        entries.push({
          sessionScope,
          key: crypto.randomUUID(),
          name: file.name,
          file,
          status: "selected",
        });
      } catch (e) {
        setError(studioError(e));
      }
    }
    itemsRef.current = [...itemsRef.current, ...entries];
    setItems((all) => [...all, ...entries]);
    for (const entry of entries) void upload(entry);
  }
  function select(asset: StudioAsset) {
    setError("");
    if (itemsRef.current.some((a) => a.assetId === asset.assetId)) return;
    if (itemsRef.current.length >= 8) {
      setError("Attach up to eight files per prompt.");
      return;
    }
    const next = [
      ...itemsRef.current,
      {
        sessionScope,
        key: asset.assetId,
        assetId: asset.assetId,
        name: asset.name,
        status: "ready" as const,
      },
    ];
    itemsRef.current = next;
    setItems((all) => [...all, next[next.length - 1]]);
  }
  return {
    items,
    error,
    select,
    addFiles,
    remove: (key: string) => setItems((v) => v.filter((a) => a.key !== key)),
    clear: () =>
      setItems((all) =>
        all.filter((a) => (a.sessionScope ?? "") !== sessionScope),
      ),
    retry: (key: string) => {
      const entry = itemsRef.current.find((a) => a.key === key);
      if (entry) void upload(entry);
    },
    blocked: items.some((a) => a.status !== "ready"),
    selectedAssetIds: items
      .filter((a) => a.status === "ready" && a.assetId)
      .map((a) => a.assetId!),
    validationError: validation.isError
      ? studioError(validation.error)
      : undefined,
    recheck: () => void validation.refetch(),
  };
}

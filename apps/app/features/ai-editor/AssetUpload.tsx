"use client";
import { AppSelect } from "@blynta/ui";
import { SelectItem } from "@blynta/ui/primitives/select";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { axiosClient } from "@/config/axiosClient";
import { AppButton as Button } from "@blynta/ui";
import { studioError } from "./queries";
const formats: Record<string, string> = {
  png: "image/png",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
};
export function AssetUpload() {
  const client = useQueryClient();
  const [destination, setDestination] = useState("");
  const [notice, setNotice] = useState("");
  const folders = useQuery({
    queryKey: ["ai-editor", "asset-folders"],
    queryFn: async () =>
      (
        await axiosClient.get<{ id: string; name: string }[]>(
          "/studio/projects",
        )
      ).data.map((p) => ({ id: p.id, name: p.name })),
  });
  const create = useMutation({
    mutationFn: async () =>
      (
        await axiosClient.post<{ id: string }>("/studio/projects", {
          name: "AI Studio assets",
          ratio: "9:16",
        })
      ).data,
    retry: false,
    onSuccess: (p) => {
      setDestination(p.id);
      void client.invalidateQueries({
        queryKey: ["ai-editor", "asset-folders"],
      });
    },
  });
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const mimeType = formats[file.name.split(".").pop()?.toLowerCase() ?? ""];
      if (!mimeType || file.size > 100 * 1024 * 1024 || !file.size)
        throw new Error(
          "Choose a PNG, MP3, WAV, M4A, or OGG file up to 100 MiB.",
        );
      if (!destination) throw new Error("Select an asset workspace first.");
      const { data } = await axiosClient.post<{
        assetId: string;
        uploadUrl: string;
      }>(`/studio/projects/${destination}/assets/upload`, {
        name: file.name,
        size: file.size,
        mimeType,
      });
      const response = await fetch(data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": mimeType },
        body: file,
      });
      if (!response.ok)
        throw new Error("The file upload failed. Please try again.");
      await axiosClient.post(
        `/studio/projects/${destination}/assets/complete`,
        { assetId: data.assetId },
      );
    },
    retry: false,
    gcTime: 0,
    onSuccess: () => {
      setNotice(
        "Upload received. Media validation runs in the background; refresh assets shortly.",
      );
      void client.invalidateQueries({ queryKey: ["ai-editor", "assets"] });
    },
  });
  return (
    <div className="mt-3 space-y-2 rounded-lg border p-3">
      <p className="text-xs font-medium">Upload your own asset</p>
      <p className="text-xs leading-5 text-muted-foreground">
        Assets use the existing Studio library. Uploading does not change a
        video or start a render.
      </p>
      <label className="block text-xs">
        Asset workspace
        <AppSelect
          aria-label="Asset workspace"
          value={destination}
          onValueChange={(e) => setDestination(e)}
          disabled={upload.isPending}
        >
          <SelectItem value="">Choose a workspace</SelectItem>
          {folders.data?.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </AppSelect>
      </label>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={create.isPending || upload.isPending}
        onClick={() => create.mutate()}
      >
        Create asset workspace
      </Button>
      <label className="block text-xs">
        PNG image or audio file
        <input
          type="file"
          accept=".png,.mp3,.wav,.m4a,.ogg"
          disabled={!destination || upload.isPending}
          className="mt-2 block w-full text-xs file:mr-2 file:rounded-md file:border file:bg-muted file:px-2 file:py-1 focus-visible:ring-2 focus-visible:ring-primary"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              setNotice("");
              upload.mutate(file);
            }
            e.target.value = "";
          }}
        />
      </label>
      {upload.isPending && (
        <p role="status" className="text-xs text-muted-foreground">
          Uploading and registering asset…
        </p>
      )}
      {notice && (
        <p role="status" className="text-xs text-muted-foreground">
          {notice}
        </p>
      )}
      {(upload.isError || create.isError || folders.isError) && (
        <p role="alert" className="text-xs text-destructive">
          {studioError(upload.error ?? create.error ?? folders.error)}
        </p>
      )}
    </div>
  );
}

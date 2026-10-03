"use client";
import { useState } from "react";
import { useEditor } from "../hooks/useEditor";
import { uploadMedia } from "../../projects/media";

export function useMediaUpload() {
  const e = useEditor();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function upload(file?: File, addToTimeline = false) {
    if (!file || busy) return;
    setBusy(true);
    setError("");
    try {
      const asset = await uploadMedia(e.projectId, file);
      e.edit((doc) => ({ ...doc, assets: [...doc.assets, asset] }));
      if (addToTimeline) e.add(asset);
      await e.refreshMedia();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not upload this file.",
      );
    } finally {
      setBusy(false);
    }
  }
  return { upload, busy, error };
}

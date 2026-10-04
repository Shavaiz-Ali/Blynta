"use client";
import { useRef, useState } from "react";
import { AppButton, AppSpinner } from "@blynta/ui";
import { Film } from "lucide-react";
import { toast } from "sonner";
import { axiosClient } from "@/config/axiosClient";
import { studioEditorUrl } from "../../studio-navigation";
export function EditInStudioButton({
  jobId,
  clipId,
  ready = true,
}: {
  jobId: string;
  clipId: string;
  ready?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  return (
    <AppButton
      size="sm"
      variant="outline"
      className="h-9"
      aria-busy={busy}
      disabled={busy || !ready}
      title={
        ready
          ? "Open this clip in Blynta Studio"
          : "This clip is still processing"
      }
      icon={busy ? <AppSpinner size="xs" /> : <Film />}
      onClick={async () => {
        if (pending.current || !ready) return;
        pending.current = true;
        setBusy(true);
        try {
          const { data: project } = await axiosClient.post<{ id: string }>(
            "/studio/from-clip",
            { jobId, clipId },
          );
          window.location.assign(
            studioEditorUrl(project.id, process.env.NEXT_PUBLIC_STUDIO_URL),
          );
        } catch {
          toast.error("Could not open this clip in Studio. Please try again.");
          pending.current = false;
          setBusy(false);
        }
      }}
    >
      {busy ? "Opening Studio…" : "Edit in Studio"}
    </AppButton>
  );
}

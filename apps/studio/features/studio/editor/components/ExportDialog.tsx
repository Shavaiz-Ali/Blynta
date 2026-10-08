"use client";
import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreditEstimate } from "@blynta/types";
import { InsufficientCredits } from "@blynta/ui";
import { Download, FileJson, Film } from "lucide-react";
import { AppDialog, AppSelect, AppButton } from "@blynta/ui";
import { useEditor } from "../hooks/useEditor";
import {
  persistentDocument,
  studioKeys,
  studioRequest,
  type RenderStatus,
} from "../../api";
export function ExportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const e = useEditor();
  const queryClient = useQueryClient();
  const operationId = useRef<{ signature: string; id: string } | undefined>(
    undefined,
  );
  const [resolution, setResolution] = useState("1080p");
  const [fps, setFps] = useState("30");
  const [renderId, setRenderId] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState("");
  const estimate = useQuery({
    queryKey: [
      "studio",
      "export-estimate",
      e.projectId,
      e.doc,
      resolution,
      fps,
    ],
    queryFn: () =>
      studioRequest<CreditEstimate>(
        `projects/${e.projectId}/render-estimate`,
        "POST",
        {
          document: persistentDocument(e.doc),
          settings: { resolution, fps: Number(fps), format: "mp4" },
        },
      ),
    enabled: open && !!e.duration,
    staleTime: 5000,
    refetchInterval: open ? 15000 : false,
  });
  const status = useQuery({
    queryKey: studioKeys.render(renderId, e.userId),
    queryFn: () => studioRequest<RenderStatus>(`renders/${renderId}`),
    enabled: !!renderId,
    refetchInterval: (query) =>
      ["completed", "failed"].includes(query.state.data?.status || "")
        ? false
        : 2000,
  });
  const active =
    preparing ||
    (!!renderId &&
      !["completed", "failed"].includes(status.data?.status || ""));
  const renderState = status.data?.status;
  const refetchEstimate = estimate.refetch;
  useEffect(() => {
    if (renderState && ["completed", "failed"].includes(renderState)) {
      void queryClient.invalidateQueries({ queryKey: ["workspace"] });
      void refetchEstimate();
      operationId.current = undefined;
    }
  }, [renderState, queryClient, refetchEstimate]);
  async function render() {
    setPreparing(true);
    setError("");
    try {
      const revision = await e.flushSave();
      const signature = JSON.stringify([
        e.projectId,
        revision,
        resolution,
        fps,
        estimate.data?.pricingVersion,
      ]);
      if (operationId.current?.signature !== signature)
        operationId.current = { signature, id: crypto.randomUUID() };
      const result = await studioRequest<RenderStatus>(
        `projects/${e.projectId}/renders`,
        "POST",
        {
          revision,
          settings: { resolution, fps: Number(fps), format: "mp4" },
          ...(estimate.data?.enabled
            ? {
                operationId: operationId.current.id,
                authorizedCredits: estimate.data.totalCredits,
                pricingVersion: estimate.data.pricingVersion,
              }
            : {}),
        },
      );
      setRenderId(result.id);
      void queryClient.invalidateQueries({ queryKey: ["workspace"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start export");
    } finally {
      setPreparing(false);
    }
  }
  function downloadPlan() {
    const url = URL.createObjectURL(
      new Blob(
        [JSON.stringify({ version: 1, ...persistentDocument(e.doc) }, null, 2)],
        { type: "application/json" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${e.doc.name.replace(/[^a-z0-9_-]/gi, "_")}.blynta.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Export video"
      description="Choose the quality for your MP4 video."
      size="lg"
      contentClassName="editor-export-dialog"
      bodyClassName="editor-export-body"
      footerClassName="editor-export-footer"
      footer={
        <>
          <AppButton
            variant="outline"
            icon={<FileJson size={16} />}
            onClick={downloadPlan}
          >
            Download edit plan
          </AppButton>
          <AppButton
            disabled={
              active ||
              !e.duration ||
              !estimate.data ||
              (estimate.data.enabled &&
                estimate.data.totalCredits > estimate.data.available)
            }
            isLoading={preparing}
            icon={<Film size={16} />}
            onClick={render}
          >
            {estimate.data?.enabled
              ? `Authorize ${estimate.data.totalCredits} credits and export`
              : renderId
                ? "Export again"
                : "Export video"}
          </AppButton>
        </>
      }
    >
      <div className="export-project-summary">
        <span className="export-project-icon">
          <Film size={22} />
        </span>
        <div>
          <strong title={e.doc.name}>{e.doc.name}</strong>
          <p>
            {e.doc.ratio} · {e.duration.toFixed(1)} seconds
          </p>
        </div>
        <span className="export-format">MP4</span>
      </div>
      <div className="export-settings">
        <AppSelect
          label="Resolution"
          disabled={active}
          value={resolution}
          onValueChange={setResolution}
          options={["1080p", "720p"].map((value) => ({ value, label: value }))}
        />
        <AppSelect
          label="Frame rate"
          disabled={active}
          value={fps}
          onValueChange={setFps}
          options={["24", "30", "60"].map((value) => ({
            value,
            label: `${value} fps`,
          }))}
        />
      </div>
      {estimate.isPending && !!e.duration && (
        <p role="status">Estimating export credits…</p>
      )}
      {estimate.error && (
        <p role="alert">
          {estimate.error.message}{" "}
          <AppButton variant="link" onClick={() => void estimate.refetch()}>
            Retry estimate
          </AppButton>
        </p>
      )}
      {estimate.data?.enabled && (
        <div className="space-y-2 text-sm">
          <p>
            {estimate.data.totalCredits} credits for this cloud export ·{" "}
            {estimate.data.available} available.
          </p>
          <p className="text-muted-foreground">
            Credits are held while rendering and charged on delivery. Failed
            exports release the hold. Editing and local previews are included.
          </p>
          {estimate.data.totalCredits > estimate.data.available && (
            <InsufficientCredits
              required={estimate.data.totalCredits}
              available={estimate.data.available}
              billingUrl={
                process.env.NEXT_PUBLIC_BLYNTA_URL
                  ? `${process.env.NEXT_PUBLIC_BLYNTA_URL}/billing`
                  : undefined
              }
            />
          )}
        </div>
      )}
      {!e.duration && (
        <p className="export-empty-hint">
          Add media to your timeline to export a video.
        </p>
      )}
      {(preparing || status.data) && (
        <div role="status" className="export-progress">
          <p>
            {preparing
              ? "Saving your latest edits…"
              : status.data?.status === "processing"
                ? "Rendering your video"
                : status.data?.status === "queued"
                  ? "Waiting to render"
                  : status.data?.status === "completed"
                    ? "Your video is ready"
                    : "Export failed"}
            <span>{preparing ? "" : `${status.data?.progress || 0}%`}</span>
          </p>
          <progress
            aria-label="Export progress"
            max={100}
            value={preparing ? 0 : status.data?.progress || 0}
          />
        </div>
      )}
      {(error || status.error || status.data?.error) && (
        <p role="alert" className="export-error">
          {error || status.error?.message || status.data?.error}
        </p>
      )}
      {status.error && (
        <AppButton variant="outline" onClick={() => void status.refetch()}>
          Retry export status
        </AppButton>
      )}
      {status.data?.outputUrl && (
        <AppButton
          icon={<Download size={16} />}
          nativeButton={false}
          role="link"
          render={
            <a
              href={status.data.outputUrl}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
        >
          Download video
        </AppButton>
      )}
    </AppDialog>
  );
}

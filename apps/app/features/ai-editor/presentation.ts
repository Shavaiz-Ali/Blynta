import type {
  EditingPlan,
  PatchChange,
  Proposal,
  RenderStatus,
} from "./contracts";
export function renderPollInterval(status?: RenderStatus) {
  return status === "queued" || status === "processing" ? 2500 : false;
}
export function proposalPollInterval(status?: Proposal["status"]) {
  return status === "generating" || status === "applying" ? 2500 : false;
}
export function editTime(value: number) {
  const minutes = Math.floor(value / 60);
  return `${String(minutes).padStart(2, "0")}:${(value % 60).toFixed(1).padStart(4, "0")}`;
}
export function describeChange(change: PatchChange, plan?: EditingPlan) {
  if ("operation" in change) {
    const op = change.operation;
    const labels: Record<string, string> = {
      zoom: "Zoom",
      crop: "Crop",
      image_overlay: "Image overlay",
      emoji_overlay: "Emoji overlay",
      text_overlay: "Text overlay",
      transition: "Fade",
    };
    const details =
      op.type === "zoom"
        ? `${op.params.fromScale}× → ${op.params.toScale}× · ${op.params.easing === "easeInOut" ? "Smooth" : "Linear"}`
        : op.type === "text_overlay"
          ? String(op.params.text)
          : op.type === "emoji_overlay"
            ? String(op.params.emoji)
            : op.type === "crop"
              ? `Region ${Math.round(Number(op.params.width) * 100)}% × ${Math.round(Number(op.params.height) * 100)}%`
              : op.type === "transition"
                ? String(op.params.kind).replaceAll("_", " ")
                : "Uses an owned image asset";
    return {
      title: `${change.action === "add" ? "Add" : "Update"} ${labels[op.type] ?? "effect"}`,
      detail: `${editTime(op.start)} – ${editTime(op.end)} · ${details}`,
    };
  }
  if ("track" in change)
    return {
      title: `${change.action === "add_audio_track" ? "Add" : "Update"} ${change.track.role.replaceAll("_", " ")}`,
      detail: `${editTime(change.track.start)} – ${editTime(change.track.start + change.track.sourceEnd - change.track.sourceStart)} · Volume ${Math.round(change.track.gain * 100)}% · Fades ${change.track.fadeIn}s / ${change.track.fadeOut}s`,
    };
  if (change.action === "update_original_audio")
    return {
      title: "Adjust original audio",
      detail: `${change.controls.enabled ? `Volume ${Math.round(change.controls.gain * 100)}%` : "Muted"} · Fades ${change.controls.fadeIn}s / ${change.controls.fadeOut}s · ${change.controls.mutes.length} muted ranges · ${change.controls.automation.length} volume points`,
    };
  if ("operationId" in change) {
    const op = plan?.plan.operations.find((o) => o.id === change.operationId);
    return {
      title: `${change.action} ${op?.type.replaceAll("_", " ") ?? "effect"}`,
      detail: op
        ? `${editTime(op.start)} – ${editTime(op.end)}`
        : "An existing effect in this clip",
    };
  }
  return {
    title: change.action.replaceAll("_", " "),
    detail: "An existing audio track in this clip",
  };
}

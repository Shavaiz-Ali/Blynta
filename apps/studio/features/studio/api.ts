import { productFetch } from "@blynta/auth/client";
import type { AIProposal, Asset, EditorDocument, Project } from "./types";
export class StudioApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function studioRequest<T>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await productFetch(`/api/studio/${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  const json = await response.json();
  if (!response.ok || !json.success)
    throw new StudioApiError(
      json.error?.message || json.message || "Studio request failed.",
      response.status,
    );
  return json.data as T;
}
// Signed URLs never enter persistence or AI context.
export function persistentDocument(doc: EditorDocument) {
  return {
    ...doc,
    name: doc.name.trim() || "Untitled project",
    assets: doc.assets.map(
      ({ id, name, kind, duration, origin, sourceGroup }) => ({
        id,
        name,
        kind,
        duration,
        origin,
        sourceGroup,
      }),
    ),
  };
}
export const studioKeys = {
  projects: (userId: string) => ["studio", userId, "projects"] as const,
  project: (id: string, userId: string) =>
    ["studio", userId, "project", id] as const,
  assets: (id: string, userId: string) =>
    ["studio", userId, "assets", id] as const,
  render: (id: string, userId: string) =>
    ["studio", userId, "render", id] as const,
};
export const studioApi = {
  list: () => studioRequest<Project[]>("projects"),
  project: (id: string) => studioRequest<Project>(`projects/${id}`),
  create: (name: string, ratio: string) =>
    studioRequest<Project>("projects", "POST", { name, ratio }),
  save: async (
    id: string,
    revision: number,
    doc: EditorDocument,
    keepalive = false,
  ) => {
    const body = JSON.stringify({
      version: 1,
      revision,
      document: persistentDocument(doc),
    });
    const r = await productFetch(`/api/studio/projects/${id}/timeline`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive,
    });
    const json = await r.json();
    if (!r.ok || !json.success)
      throw new StudioApiError(json.error?.message || "Save failed", r.status);
    return json.data as { revision: number; updatedAt: string };
  },
  assets: (id: string) => studioRequest<Asset[]>(`projects/${id}/assets`),
  propose: (
    id: string,
    prompt: string,
    document: EditorDocument,
    targetClipId?: string,
    signal?: AbortSignal,
    authorization?: {
      operationId: string;
      authorizedCredits: number;
      pricingVersion: string;
    },
  ) =>
    studioRequest<AIProposal>(
      `projects/${id}/ai/propose`,
      "POST",
      {
        prompt,
        document: persistentDocument(document),
        targetClipId,
        ...authorization,
      },
      signal,
    ),
};
export interface RenderStatus {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress: number;
  error?: string;
  outputUrl?: string;
}

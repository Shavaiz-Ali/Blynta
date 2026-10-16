"use client";
import { API_ENDPOINTS, HTTP_STATUS } from "@blynta/types/contracts";
import {
  useIsMutating,
  useMutation,
  useQuery,
  useInfiniteQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { axiosClient, ApiError } from "@/config/axiosClient";
import type {
  EditingPlan,
  EditingVersion,
  Proposal,
  StudioAsset,
  StudioMessage,
  StudioState,
  PromptSubmission,
  AgentSession,
  StudioClip,
  StudioProject,
} from "./contracts";
import { renderPollInterval, proposalPollInterval } from "./presentation";
export const studioKeys = {
  clips: (search: string, sort: string, page: number) =>
    ["ai-editor", "clips", search, sort, page] as const,
  sessions: (clip: string, plan: string) =>
    ["ai-editor", "sessions", clip, plan] as const,
  recent: ["ai-editor", "recent"] as const,
  projects: (search: string, sort: string, page: number) =>
    ["ai-editor", "recent", search, sort, page] as const,
  plan: (id: string) => ["ai-editor", "plan", id] as const,
  versions: (id: string, page = 1) =>
    ["ai-editor", "versions", id, page] as const,
  version: (id: string) => ["ai-editor", "version", id] as const,
  state: (clip: string, plan: string) =>
    ["ai-editor", "state", clip, plan] as const,
  proposal: (id: string) => ["ai-editor", "proposal", id] as const,
  session: (id: string) => ["ai-editor", "session", id] as const,
};
const get = async <T>(path: string, signal?: AbortSignal) =>
  (await axiosClient.get<T>(path, { signal })).data;
export function studioError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === HTTP_STATUS.CONFLICT)
      return "The clip or proposal changed. Refresh the editing plan before continuing.";
    if (error.status === HTTP_STATUS.TOO_MANY_REQUESTS)
      return "Request limit reached. Wait before trying again.";
    if (error.status === HTTP_STATUS.FORBIDDEN)
      return "This action is not available for your account. Check your subscription and clip access.";
    if (error.status === HTTP_STATUS.UNAUTHORIZED)
      return "Sign in again to continue editing.";
    if (
      !error.status ||
      error.status === HTTP_STATUS.NOT_FOUND ||
      error.status >= HTTP_STATUS.INTERNAL_SERVER_ERROR
    )
      return "The editing service is temporarily unavailable. Please try again shortly.";
  }
  if (
    error instanceof Error &&
    /Cannot (GET|POST|PATCH|DELETE)|Network Error|Request failed with status|ECONN|fetch failed/i.test(
      error.message,
    )
  )
    return "The editing service is temporarily unavailable. Please try again shortly.";
  return error instanceof Error
    ? error.message
    : "The request failed. Please try again.";
}
export function useStudioProjects(
  search: string,
  sort: string,
  page: number,
  enabled = true,
) {
  return useQuery({
    queryKey: studioKeys.projects(search, sort, page),
    enabled,
    queryFn: ({ signal }) =>
      get<{ items: StudioProject[]; totalPages: number; total: number }>(
        `${API_ENDPOINTS.editor.plans}?${new URLSearchParams({ search, sort, page: String(page) })}`,
        signal,
      ),
    placeholderData: keepPreviousData,
    refetchInterval: (q) =>
      q.state.data?.items.some(
        (p) =>
          p.latestPreview?.status === "queued" ||
          p.latestPreview?.status === "processing",
      )
        ? 2500
        : false,
  });
}
export function useInitializePlan() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: { jobId: string; clipId: string }) =>
      (
        await axiosClient.post<EditingPlan>(
          API_ENDPOINTS.editor.initialize,
          body,
        )
      ).data,
    retry: false,
    onSuccess: (plan) => {
      client.setQueryData(studioKeys.plan(plan._id), plan);
      void client.invalidateQueries({ queryKey: studioKeys.recent });
      void client.invalidateQueries({ queryKey: ["ai-editor", "clips"] });
    },
  });
}
export function useEditingPlan(id: string) {
  return useQuery({
    queryKey: studioKeys.plan(id),
    enabled: !!id,
    queryFn: ({ signal }) =>
      get<EditingPlan>(API_ENDPOINTS.editor.plan(id), signal),
    staleTime: 0,
  });
}
export function useEditingState(clip: string, plan: string) {
  const submitting = useIsMutating({
    mutationKey: ["ai-editor", "propose", clip, plan],
  });
  return useQuery({
    queryKey: studioKeys.state(clip, plan),
    enabled: !!plan,
    queryFn: ({ signal }) =>
      get<StudioState>(API_ENDPOINTS.editor.state(clip, plan), signal),
    // Also poll while the synchronous propose POST is running: its first
    // generating record may not exist in the previous state snapshot yet.
    refetchInterval: (q) =>
      submitting ||
      q.state.data?.proposals.some((p) => proposalPollInterval(p.status))
        ? 1500
        : false,
  });
}
export function useEditingSession(clip: string, id: string) {
  const query = useInfiniteQuery({
    queryKey: studioKeys.session(id),
    enabled: !!id,
    initialPageParam: "",
    queryFn: ({ signal, pageParam }) =>
      get<{
        session: AgentSession;
        messages: StudioMessage[];
        proposals: Proposal[];
        nextCursor?: string | null;
      }>(
        `${API_ENDPOINTS.editor.session(clip, id)}${pageParam ? `?before=${encodeURIComponent(pageParam)}` : ""}`,
        signal,
      ),
    getNextPageParam: (last) => last.nextCursor || undefined,
  });
  return {
    ...query,
    data: query.data
      ? {
          session: query.data.pages[0].session,
          messages: [...query.data.pages].reverse().flatMap((p) => p.messages),
          proposals: [
            ...new Map(
              [...query.data.pages]
                .reverse()
                .flatMap((p) => p.proposals || [])
                .map((p) => [p._id, p]),
            ).values(),
          ],
        }
      : undefined,
  };
}
export function useProposal(clip: string, id: string) {
  return useQuery({
    queryKey: studioKeys.proposal(id),
    enabled: !!id,
    queryFn: ({ signal }) =>
      get<Proposal>(API_ENDPOINTS.editor.proposal(clip, id), signal),
    refetchInterval: (q) => proposalPollInterval(q.state.data?.status),
  });
}
export function useProposeEdit(clip: string, plan: string) {
  const client = useQueryClient();
  return useMutation({
    mutationKey: ["ai-editor", "propose", clip, plan],
    mutationFn: async (body: PromptSubmission) =>
      (
        await axiosClient.post<Proposal>(
          API_ENDPOINTS.editor.propose(clip),
          body,
          { timeout: 100000 },
        )
      ).data,
    retry: false,
    onSuccess: (p) => {
      client.setQueryData(studioKeys.proposal(p._id), p);
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: studioKeys.state(clip, plan) });
      void client.invalidateQueries({
        queryKey: studioKeys.sessions(clip, plan),
      });
      void client.invalidateQueries({ queryKey: ["ai-editor", "session"] });
    },
  });
}
export function useProposalAction(
  clip: string,
  plan: string,
  action: "apply" | "reject" | "cancel",
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (
        await axiosClient.post<EditingPlan | Proposal>(
          API_ENDPOINTS.editor.proposalAction(clip, id, action),
        )
      ).data,
    retry: false,
    onSettled: () => {
      void client.invalidateQueries({ queryKey: studioKeys.plan(plan) });
      void client.invalidateQueries({ queryKey: studioKeys.state(clip, plan) });
      void client.invalidateQueries({ queryKey: ["ai-editor", "proposal"] });
      void client.invalidateQueries({ queryKey: ["ai-editor", "session"] });
      void client.invalidateQueries({ queryKey: studioKeys.recent });
    },
  });
}
export function useEditingVersions(plan: string, page: number) {
  return useQuery({
    queryKey: studioKeys.versions(plan, page),
    enabled: !!plan,
    queryFn: ({ signal }) =>
      get<{ items: EditingVersion[]; page: number; pageSize: number }>(
        `${API_ENDPOINTS.editor.versions(plan)}?page=${page}`,
        signal,
      ),
    refetchInterval: (q) =>
      q.state.data?.items.some((v) => renderPollInterval(v.status))
        ? 2500
        : false,
  });
}
export function useEditingVersion(id: string) {
  return useQuery({
    queryKey: studioKeys.version(id),
    enabled: !!id,
    queryFn: ({ signal }) =>
      get<EditingVersion>(API_ENDPOINTS.editor.version(id), signal),
    refetchInterval: (q) => renderPollInterval(q.state.data?.status),
    staleTime: 45 * 60000,
    refetchOnWindowFocus: "always",
  });
}
export function useRenderAction(
  plan: string,
  action: "preview" | "cancel" | "retry",
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string | { expectedRevision: number }) =>
      (
        await axiosClient.post<EditingVersion>(
          action === "preview"
            ? API_ENDPOINTS.editor.preview(plan)
            : API_ENDPOINTS.editor.versionAction(String(id), action),
          action === "preview" && typeof id === "object" ? id : undefined,
        )
      ).data,
    retry: false,
    onSuccess: (v) => client.setQueryData(studioKeys.version(v._id), v),
    onSettled: () => {
      void client.invalidateQueries({
        queryKey: ["ai-editor", "versions", plan],
      });
      void client.invalidateQueries({ queryKey: ["ai-editor", "version"] });
      void client.invalidateQueries({ queryKey: studioKeys.plan(plan) });
      void client.invalidateQueries({ queryKey: studioKeys.recent });
    },
  });
}
export function useStudioClips(
  search: string,
  sort: string,
  page: number,
  enabled = true,
) {
  return useQuery({
    queryKey: studioKeys.clips(search, sort, page),
    enabled,
    queryFn: ({ signal }) =>
      get<{ items: StudioClip[]; totalPages: number; total: number }>(
        `${API_ENDPOINTS.editor.clips}?${new URLSearchParams({ search, sort, page: String(page) })}`,
        signal,
      ),
    staleTime: 30000,
    placeholderData: keepPreviousData,
  });
}
export function useStudioSessions(clip: string, plan: string) {
  return useQuery({
    queryKey: studioKeys.sessions(clip, plan),
    enabled: !!plan,
    queryFn: ({ signal }) =>
      get<{ items: AgentSession[] }>(
        `${API_ENDPOINTS.editor.sessions(clip)}?planId=${encodeURIComponent(plan)}`,
        signal,
      ),
  });
}
export function useSessionAction(clip: string, plan: string) {
  const client = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: async (
      input:
        | { id: string; title?: string; status?: "active" | "archived" }
        | { requestId: string },
    ) => {
      if ("id" in input) {
        const { id, ...body } = input;
        return (
          await axiosClient.patch<AgentSession>(
            API_ENDPOINTS.editor.session(clip, id),
            body,
          )
        ).data;
      }
      return (
        await axiosClient.post<AgentSession>(
          API_ENDPOINTS.editor.sessions(clip),
          { ...input, planId: plan },
        )
      ).data;
    },
    onSuccess: () => {
      void client.invalidateQueries({
        queryKey: studioKeys.sessions(clip, plan),
      });
      void client.invalidateQueries({ queryKey: studioKeys.state(clip, plan) });
      void client.invalidateQueries({ queryKey: ["ai-editor", "session"] });
    },
  });
}
export function useEditingAssets() {
  return useQuery({
    queryKey: ["ai-editor", "assets"],
    queryFn: ({ signal }) =>
      get<{ items: StudioAsset[] }>(API_ENDPOINTS.editor.assets, signal),
  });
}
export async function freshVersion(id: string) {
  return get<EditingVersion>(API_ENDPOINTS.editor.version(id));
}
export async function downloadEditingVersion(id: string) {
  return (
    await axiosClient.post<{ signedUrl: string }>(
      API_ENDPOINTS.editor.versionAction(id, "download"),
    )
  ).data;
}

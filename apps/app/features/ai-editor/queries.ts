"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { axiosClient, ApiError } from "@/config/axiosClient";
import type {
  EditingPlan,
  EditingVersion,
  Proposal,
  StudioAsset,
  StudioMessage,
  StudioState,
  PromptSubmission,
} from "./contracts";
import { renderPollInterval, proposalPollInterval } from "./presentation";
export const studioKeys = {
  recent: ["ai-editor", "recent"] as const,
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
    if (error.status === 409)
      return "The clip or proposal changed. Refresh the editing plan before continuing.";
    if (error.status === 429)
      return "Request limit reached. Wait before trying again.";
    if (error.status === 403)
      return "This action is not available for your account. Check your subscription and clip access.";
    if (error.status === 401) return "Sign in again to continue editing.";
    if (!error.status || error.status === 404 || error.status >= 500)
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
export function useRecentPlans() {
  return useQuery({
    queryKey: studioKeys.recent,
    queryFn: ({ signal }) =>
      get<{ items: EditingPlan[] }>("/ai-editor/plans", signal),
  });
}
export function useInitializePlan() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: { jobId: string; clipId: string }) =>
      (await axiosClient.post<EditingPlan>("/ai-editor/initialize", body)).data,
    retry: false,
    onSuccess: (plan) => {
      client.setQueryData(studioKeys.plan(plan._id), plan);
      void client.invalidateQueries({ queryKey: studioKeys.recent });
    },
  });
}
export function useEditingPlan(id: string) {
  return useQuery({
    queryKey: studioKeys.plan(id),
    enabled: !!id,
    queryFn: ({ signal }) => get<EditingPlan>(`/ai-editor/plans/${id}`, signal),
    staleTime: 0,
  });
}
export function useEditingState(clip: string, plan: string) {
  return useQuery({
    queryKey: studioKeys.state(clip, plan),
    enabled: !!plan,
    queryFn: ({ signal }) =>
      get<StudioState>(`/clips/${clip}/ai-edit/state?planId=${plan}`, signal),
    refetchInterval: (q) =>
      q.state.data?.proposals.some((p) => proposalPollInterval(p.status))
        ? 2500
        : false,
  });
}
export function useEditingSession(clip: string, id: string) {
  return useQuery({
    queryKey: studioKeys.session(id),
    enabled: !!id,
    queryFn: ({ signal }) =>
      get<{ messages: StudioMessage[] }>(
        `/clips/${clip}/ai-edit/sessions/${id}`,
        signal,
      ),
  });
}
export function useProposal(clip: string, id: string) {
  return useQuery({
    queryKey: studioKeys.proposal(id),
    enabled: !!id,
    queryFn: ({ signal }) =>
      get<Proposal>(`/clips/${clip}/ai-edit/proposals/${id}`, signal),
    refetchInterval: (q) => proposalPollInterval(q.state.data?.status),
  });
}
export function useProposeEdit(clip: string, plan: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: PromptSubmission) =>
      (
        await axiosClient.post<Proposal>(
          `/clips/${clip}/ai-edit/propose`,
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
      void client.invalidateQueries({ queryKey: ["ai-editor", "session"] });
    },
  });
}
export function useProposalAction(
  clip: string,
  plan: string,
  action: "apply" | "reject",
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (
        await axiosClient.post<EditingPlan | Proposal>(
          `/clips/${clip}/ai-edit/proposals/${id}/${action}`,
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
        `/ai-editor/plans/${plan}/versions?page=${page}`,
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
      get<EditingVersion>(`/ai-editor/versions/${id}`, signal),
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
    mutationFn: async (id: string) =>
      (
        await axiosClient.post<EditingVersion>(
          action === "preview"
            ? `/ai-editor/plans/${plan}/preview`
            : `/ai-editor/versions/${id}/${action}`,
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
    },
  });
}
export function useEditingAssets() {
  return useQuery({
    queryKey: ["ai-editor", "assets"],
    queryFn: ({ signal }) =>
      get<{ items: StudioAsset[] }>("/ai-editor/assets", signal),
  });
}
export async function freshVersion(id: string) {
  return get<EditingVersion>(`/ai-editor/versions/${id}`);
}
export async function downloadEditingVersion(id: string) {
  return (
    await axiosClient.post<{ signedUrl: string }>(
      `/ai-editor/versions/${id}/download`,
    )
  ).data;
}

"use client";
import { API_ENDPOINTS, AI_TASK, type AITask } from "@blynta/types/contracts";
import { useQuery } from "@tanstack/react-query";
import { axiosClient } from "@/config/axiosClient";
export interface AvailableEditingModels {
  plan: "free" | "pro" | "business";
  selectionAllowed: boolean;
  defaultModelId: string | null;
  compatibilityMode?: boolean;
  models: {
    id: string;
    displayName: string;
    description?: string;
    provider: string;
    selectable: boolean;
    capabilities: { structuredOutput: boolean };
  }[];
}
export function useAvailableEditingModels(
  task: AITask = AI_TASK.EDIT_PLANNING,
) {
  return useQuery({
    queryKey: ["ai-editor", "available-models", task],
    queryFn: async ({ signal }) =>
      (
        await axiosClient.get<AvailableEditingModels>(
          API_ENDPOINTS.ai.availableModels,
          {
            params: { task },
            signal,
          },
        )
      ).data,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

"use client";
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
  task:
    | "highlight_detection"
    | "edit_planning"
    | "edit_refinement" = "edit_planning",
) {
  return useQuery({
    queryKey: ["ai-editor", "available-models", task],
    queryFn: async ({ signal }) =>
      (
        await axiosClient.get<AvailableEditingModels>("/ai/models/available", {
          params: { task },
          signal,
        })
      ).data,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

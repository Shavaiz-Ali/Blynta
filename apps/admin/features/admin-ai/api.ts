import { axiosClient } from "@/config/axiosClient";
export interface Provider {
  _id: string;
  code: string;
  name: string;
  adapter: "google" | "openai" | "anthropic";
  enabled: boolean;
  configured: boolean;
  modelCount: number;
  description?: string;
  defaultCredentialId?: string | null;
}
export interface Credential {
  _id: string;
  label: string;
  enabled: boolean;
  lastValidatedAt?: string;
  lastValidationStatus?: string;
}
export interface AIModel {
  _id: string;
  providerId: string;
  credentialId?: string | null;
  modelId: string;
  displayName: string;
  description?: string;
  enabled: boolean;
  isDefault: boolean;
  tasks?: ("highlight_detection" | "edit_planning" | "edit_refinement")[];
  capabilities: {
    text: boolean;
    vision: boolean;
    audioInput: boolean;
    structuredOutput: boolean;
    toolCalling: boolean;
  };
  settings: {
    temperature?: number;
    maxOutputTokens: number;
    timeoutMs: number;
    maxRetries: number;
  };
  access: {
    allowedPlans: ("free" | "pro" | "business")[];
    selectable: boolean;
  };
  priority: number;
  lastTestStatus?: string;
  lastTestedAt?: string;
  pricing?: {
    inputCostPerMillionTokens: number;
    outputCostPerMillionTokens: number;
    currency: "USD";
  };
}
export interface List<T> {
  items: T[];
  page: number;
  pageSize: number;
}
export interface Usage {
  _id: string;
  modelId: string;
  status: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
  estimatedCostUsd?: number;
  createdAt: string;
}
export interface UsageSummary {
  _id: string;
  requests: number;
  successes: number;
  failures: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  pricedRequests: number;
  averageLatencyMs: number;
}
export const aiAdminApi = {
  providers: async (params?: Record<string, string | number>) =>
    (await axiosClient.get<List<Provider>>("/admin/ai/providers", { params }))
      .data,
  models: async (params?: Record<string, string | number>) =>
    (await axiosClient.get<List<AIModel>>("/admin/ai/models", { params })).data,
  usage: async (params?: Record<string, string | number>) =>
    (
      await axiosClient.get<List<Usage> & { summary: UsageSummary[] }>(
        "/admin/ai/usage",
        { params },
      )
    ).data,
  credentials: async (id: string) =>
    (
      await axiosClient.get<{ items: Credential[] }>(
        "/admin/ai/providers/" + id + "/credentials",
      )
    ).data,
  write: async (
    method: "post" | "patch" | "delete",
    path: string,
    body?: unknown,
  ) =>
    (
      await axiosClient.request({
        method,
        url: "/admin/ai/" + path,
        data: body,
      })
    ).data as unknown,
};

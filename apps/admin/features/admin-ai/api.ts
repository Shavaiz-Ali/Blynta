import {
  API_ENDPOINTS,
  type AIAdapterType,
  type AITask,
} from "@blynta/types/contracts";
import { axiosClient } from "@/config/axiosClient";
export interface Provider {
  _id: string;
  code: string;
  name: string;
  adapter: AIAdapterType;
  baseUrl?: string;
  apiVersion?: string;
  settings?: { timeoutMs?: number; maxRetries?: 0 };
  operationalAdapter?: boolean;
  enabled: boolean;
  configured: boolean;
  credentialConfigured?: boolean;
  credentialCount?: number;
  validatedCredentialCount?: number;
  accessibleModelCount?: number;
  operational?: boolean;
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
  lastValidationAttemptStatus?: string;
  lastValidationMessage?: string;
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
  readyForTasks?: boolean;
  tasks?: AITask[];
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
export interface AdapterOption {
  adapter: AIAdapterType;
  implemented: boolean;
  endpointDefaults?: { baseUrl: string; apiVersion: string };
  apiVersions?: string[];
}
export const aiAdminApi = {
  adapters: async () =>
    (
      await axiosClient.get<{ items: AdapterOption[] }>(
        API_ENDPOINTS.aiAdmin.adapters,
      )
    ).data,
  providers: async (params?: Record<string, string | number>) =>
    (
      await axiosClient.get<List<Provider>>(API_ENDPOINTS.aiAdmin.providers, {
        params,
      })
    ).data,
  models: async (params?: Record<string, string | number>) =>
    (
      await axiosClient.get<List<AIModel>>(API_ENDPOINTS.aiAdmin.models, {
        params,
      })
    ).data,
  usage: async (params?: Record<string, string | number>) =>
    (
      await axiosClient.get<List<Usage> & { summary: UsageSummary[] }>(
        API_ENDPOINTS.aiAdmin.usage,
        { params },
      )
    ).data,
  credentials: async (id: string) =>
    (
      await axiosClient.get<{ items: Credential[] }>(
        API_ENDPOINTS.aiAdmin.credentials(id),
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
        url: API_ENDPOINTS.aiAdmin.root + path,
        data: body,
      })
    ).data as unknown,
};

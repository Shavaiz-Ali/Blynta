export interface FeatureFlag { id: string; name: string; description: string; enabled: boolean; environment: string; targeting: Record<string, string[]>; createdAt: string; updatedAt: string }
export interface ServiceHealth { id: string; name: string; status: "healthy" | "degraded" | "unavailable" | "unknown"; checkedAt?: string; latencyMs?: number; error?: string }
export interface AIUsage { provider: string; model: string; feature: string; requests: number; tokens?: number; cost?: number; currency?: string; successRate?: number; averageLatencyMs?: number }
export type Capability<T> = { available: true; data: T } | { available: false; reason: string };
// Replace these adapters when authenticated admin endpoints are implemented. Never fall back to demo records.
export const configurationService = {
  async flags(): Promise<Capability<FeatureFlag[]>> { return { available: false, reason: "Feature flag management is not connected. Flags cannot be changed from this console yet." }; },
  async aiUsage(): Promise<Capability<AIUsage[]>> { return { available: false, reason: "Provider usage, token counts, and costs are not yet available for administrative reporting." }; },
  async settings(): Promise<Capability<Record<string, unknown>>> { return { available: false, reason: "Platform configuration is managed by the deployment. Editing settings from this console is not yet supported." }; },
};

import { createHash } from 'node:crypto';
import { z } from 'zod';
import { editPatchSchema, modelPatchSchema } from './edit-patch';
import { editingCapabilities } from './edit-capabilities';
import type { CallFailure } from '../../ai-registry/call-diagnostics';

/** Only contract identifiers/counts/decisions. Never free-form model/user text. */
export interface AgentDiagnostic {
  executionId: string;
  node: string;
  event:
    | 'node_enter'
    | 'model_result'
    | 'model_started'
    | 'model_failed'
    | 'model_retry'
    | 'validation'
    | 'route'
    | 'asset_resolution';
  call?: number;
  backoffMs?: number;
  modelId?: string;
  providerModelId?: string;
  credentialRevision?: number;
  credentialChanged?: boolean;
  baseUrl?: string;
  apiVersion?: string;
  structuredOutputMethod?: 'functionCalling';
  maxOutputTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  promptBytes?: number;
  durationMs?: number;
  failure?: CallFailure;
  schemaValid?: boolean;
  outputHash?: string;
  capabilityHash?: string;
  outcome?: 'proposal' | 'clarification' | 'unsupported';
  patchJsonPresent?: boolean;
  patchSchemaValid?: boolean;
  patchIssues?: {
    path: (string | number)[];
    code: string;
    expected?: string;
    actualType: string;
    minimum?: number;
    actualCount?: number;
  }[];
  changeCount?: number;
  actions?: string[];
  operations?: string[];
  assetKinds?: string[];
  unsupportedClaim?: boolean;
  unavailableCapabilities?: string[];
  assetRequirements?: number;
  resolvedAssetCount?: number;
  requiresUserInput?: boolean;
  reason?:
    | 'PATCH_VALID'
    | 'PATCH_INVALID'
    | 'UNVERIFIED_UNSUPPORTED'
    | 'DECLARED_UNAVAILABLE'
    | 'USER_INPUT_REQUIRED'
    | 'SCHEMA_INVALID'
    | 'PROVIDER_HTTP_FAILURE'
    | 'MODEL_RESPONSE_FAILURE'
    | 'TRANSPORT_FAILURE'
    | 'ADAPTER_FAILURE'
    | 'EXECUTION_FAILURE'
    | 'PROVIDER_OR_EXECUTION_FAILURE';
  next?: string;
}
export const capabilityHash = createHash('sha256')
  .update(JSON.stringify(editingCapabilities))
  .digest('hex');
export function diagnosticOutput(value: unknown): Partial<AgentDiagnostic> {
  const parsed = z
    .object({
      outcome: z.enum(['proposal', 'clarification', 'unsupported']).optional(),
      patchJson: z.string().optional(),
      unsupported: z.string().optional(),
      unavailableCapabilities: z
        .array(z.enum(editingCapabilities.unavailableCapabilities))
        .optional(),
      assets: z
        .array(z.object({ kind: z.enum(['emoji', 'shape', 'image', 'audio']) }))
        .optional(),
    })
    .safeParse(value);
  const fields: Partial<AgentDiagnostic> = {
    outputHash: createHash('sha256')
      .update(JSON.stringify(value) ?? 'undefined')
      .digest('hex'),
  };
  if (!parsed.success) return fields;
  const output = parsed.data;
  fields.outcome = output.outcome;
  fields.unsupportedClaim =
    !!output.unsupported || output.outcome === 'unsupported';
  fields.assetKinds = output.assets?.map((asset) => asset.kind);
  fields.unavailableCapabilities = output.unavailableCapabilities;
  if (output.patchJson !== undefined) {
    fields.patchJsonPresent = !!output.patchJson;
    try {
      const patch = modelPatchSchema.safeParse(
        JSON.parse(output.patchJson) as unknown,
      );
      fields.patchSchemaValid = patch.success;
      if (!patch.success) {
        const raw: unknown = JSON.parse(output.patchJson);
        // Zod paths may contain untrusted keys. Only expose contract field names.
        const keys = new Set([
          'baseRevision',
          'changes',
          'action',
          'operation',
          'operationId',
          'id',
          'type',
          'start',
          'end',
          'params',
          'assetId',
          'emoji',
          'x',
          'y',
          'width',
          'height',
          'enabled',
          'source',
          'controls',
          'volume',
          'muted',
          'track',
          'trackId',
        ]);
        fields.patchIssues = patch.error.issues.slice(0, 12).map((issue) => {
          let actual: unknown = raw;
          for (const key of issue.path)
            actual =
              actual && typeof actual === 'object'
                ? (actual as Record<PropertyKey, unknown>)[key]
                : undefined;
          const details = issue as typeof issue & {
            expected?: string;
            minimum?: number;
          };
          return {
            path: issue.path.map((key) =>
              typeof key === 'number'
                ? key
                : keys.has(String(key))
                  ? String(key)
                  : '[field]',
            ),
            code: issue.code,
            expected: details.expected,
            actualType:
              actual === undefined
                ? 'missing'
                : actual === null
                  ? 'null'
                  : Array.isArray(actual)
                    ? 'array'
                    : typeof actual,
            minimum:
              typeof details.minimum === 'number' ? details.minimum : undefined,
            actualCount: Array.isArray(actual) ? actual.length : undefined,
          };
        });
      }
      if (patch.success) {
        const normalized = editPatchSchema.parse(patch.data);
        fields.changeCount = normalized.changes.length;
        fields.actions = normalized.changes.map((change) => change.action);
        fields.operations = normalized.changes.flatMap((change) =>
          'operation' in change ? [change.operation.type] : [],
        );
      }
    } catch {
      fields.patchSchemaValid = false;
    }
  }
  return fields;
}

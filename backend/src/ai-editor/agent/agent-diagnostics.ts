import { createHash } from 'node:crypto';
import { z } from 'zod';
import { editPatchSchema } from './edit-patch';
import { editingCapabilities } from './edit-capabilities';

/** Only contract identifiers/counts/decisions. Never free-form model/user text. */
export interface AgentDiagnostic {
  executionId: string;
  node: string;
  event:
    | 'node_enter'
    | 'model_result'
    | 'model_failed'
    | 'validation'
    | 'route'
    | 'asset_resolution';
  call?: number;
  schemaValid?: boolean;
  outputHash?: string;
  capabilityHash?: string;
  outcome?: 'proposal' | 'clarification' | 'unsupported';
  patchJsonPresent?: boolean;
  patchSchemaValid?: boolean;
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
      const patch = editPatchSchema.safeParse(
        JSON.parse(output.patchJson) as unknown,
      );
      fields.patchSchemaValid = patch.success;
      if (patch.success) {
        fields.changeCount = patch.data.changes.length;
        fields.actions = patch.data.changes.map((change) => change.action);
        fields.operations = patch.data.changes.flatMap((change) =>
          'operation' in change ? [change.operation.type] : [],
        );
      }
    } catch {
      fields.patchSchemaValid = false;
    }
  }
  return fields;
}

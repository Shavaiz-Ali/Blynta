import { ConflictException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AI_ROUTING } from './provider-policy';
import { AI_TASK } from '@blynta/types/contracts';
import { ModelRegistry } from './model-registry.service';
import type { AIModel, AIProvider } from './registry.schemas';
export interface HighlightModelSelection {
  registryId: string;
  providerId: string;
  modelId: string;
  configurationHash: string;
  auto: boolean;
}
export function highlightModelHash(model: AIModel, provider?: AIProvider) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        modelId: model.modelId,
        providerId: model.providerId,
        settings: model.settings,
        capabilities: model.capabilities,
        tasks: model.tasks,
        ...((provider?.revision ?? 1) > 1
          ? { providerRevision: provider?.revision }
          : {}),
      }),
    )
    .digest('hex');
}
@Injectable()
export class HighlightRouting {
  constructor(private registry: ModelRegistry) {}
  async select(
    userId: string,
    requested?: string,
  ): Promise<HighlightModelSelection | undefined> {
    // Compatibility is only available before any default policy has been provisioned.
    // Explicit overrides always pass current entitlement checks and never fall back.
    if (
      !requested &&
      !(await this.registry.routing.findById(AI_ROUTING.LEGACY_DEFAULT))
    )
      return undefined;
    const result = await this.registry.resolveUserModel(
      userId,
      requested,
      AI_TASK.HIGHLIGHT_DETECTION,
    );
    return {
      registryId: String(result.model._id),
      providerId: result.model.providerId,
      modelId: result.model.modelId,
      configurationHash: highlightModelHash(result.model, result.provider),
      auto: !requested,
    };
  }
  async resolve(userId: string, selection: HighlightModelSelection) {
    const result = await this.registry.resolveUserModel(
      userId,
      selection.auto ? undefined : selection.registryId,
      AI_TASK.HIGHLIGHT_DETECTION,
      selection.registryId,
    );
    if (
      result.model.providerId !== selection.providerId ||
      result.model.modelId !== selection.modelId ||
      highlightModelHash(result.model, result.provider) !==
        selection.configurationHash
    )
      throw new ConflictException(
        'Selected highlight model configuration changed; start a new job',
      );
    return result;
  }
}

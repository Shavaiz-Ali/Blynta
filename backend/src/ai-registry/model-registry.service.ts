import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserPlan } from '../users/schemas/user.schema';
import { parseEdit, objectId } from '../ai-editor/edit-plan.contract';
import type {
  AICredential,
  AIModel,
  AIProvider,
  AIRouting,
  AIUsage,
} from './registry.schemas';
import { CredentialVault } from './credential-vault.service';
import { AITask } from './registry.contract';
import { ProviderAdapterRegistry } from './provider-adapter.registry';
import { GoogleAdapter } from './google-adapter.service';
import {
  AI_ROUTING,
  AI_LIMITS,
  providerEndpoint,
  providerConfigurationHash,
  legacyProviderTestCompatible,
} from './provider-policy';
import { AI_TASK } from '@blynta/types/contracts';
export const secretSelection = '+ciphertext +iv +tag +keyVersion';
@Injectable()
export class ModelRegistry {
  constructor(
    @InjectModel('AIProvider') readonly providers: Model<AIProvider>,
    @InjectModel('AICredential') readonly credentials: Model<AICredential>,
    @InjectModel('AIModel') readonly models: Model<AIModel>,
    @InjectModel('AIRouting') readonly routing: Model<AIRouting>,
    @InjectModel('AIUsage') readonly usage: Model<AIUsage>,
    @InjectModel(User.name) private users: Model<User>,
    private vault: CredentialVault,
    private adapters: ProviderAdapterRegistry = new ProviderAdapterRegistry(
      new GoogleAdapter(),
    ),
  ) {}
  async entitlement(userId: string) {
    const user = await this.users
      .findOne({ _id: userId, isActive: true })
      .select('plan')
      .lean();
    if (!user) throw new ForbiddenException('Active account required');
    return user.plan;
  }
  async configured(id: string, requireTest = true) {
    parseEdit(objectId, id);
    const model = await this.models.findOne({ _id: id, archived: false });
    if (!model) throw new NotFoundException('AI model not found');
    const provider = await this.providers.findOne({
      _id: model.providerId,
      enabled: true,
    });
    if (!provider)
      throw new ServiceUnavailableException(
        'AI provider is unavailable or unimplemented',
      );
    this.adapters.get(provider.adapter);
    try {
      providerEndpoint(provider);
    } catch {
      throw new ServiceUnavailableException(
        'AI provider endpoint is unavailable',
      );
    }
    const credentialId = model.credentialId || provider.defaultCredentialId;
    const credential =
      credentialId &&
      (await this.credentials
        .findOne({
          _id: credentialId,
          providerId: model.providerId,
          enabled: true,
          archived: { $ne: true },
        })
        .select(secretSelection));
    if (!credential)
      throw new ServiceUnavailableException('AI credential is unavailable');
    if (
      requireTest &&
      (credential.lastValidationStatus === 'invalid' ||
        !model.enabled ||
        !model.capabilities.text ||
        !model.capabilities.structuredOutput ||
        model.lastTestStatus !== 'valid' ||
        model.testedCredentialId !== String(credential._id) ||
        model.testedCredentialRevision !== credential.revision ||
        (model.testedProviderRevision ?? 1) !== (provider.revision ?? 1) ||
        (model.testedProviderConfigurationHash
          ? model.testedProviderConfigurationHash !==
            providerConfigurationHash(provider)
          : !legacyProviderTestCompatible(provider)))
    )
      throw new ServiceUnavailableException(
        'AI model requires a successful test with its current credential',
      );
    const secret = this.vault.decrypt(
      credential,
      model.providerId + ':' + String(credential._id),
    );
    return { model, provider, credential, secret };
  }
  supportsTask(model: AIModel, task: AITask) {
    return (
      model.tasks ?? [AI_TASK.EDIT_PLANNING, AI_TASK.EDIT_REFINEMENT]
    ).includes(task);
  }
  async resolveUserModel(
    userId: string,
    requested?: string,
    task: AITask = AI_TASK.EDIT_PLANNING,
    pinnedId?: string,
  ) {
    const plan = await this.entitlement(userId);
    if (requested && plan === UserPlan.FREE)
      throw new ForbiddenException('Free accounts use Auto model routing');
    const route = requested
      ? undefined
      : await this.routing.findById(AI_ROUTING.LEGACY_DEFAULT);
    const id = pinnedId || requested || route?.modelId;
    if (!id)
      throw new ServiceUnavailableException(
        'No default AI model is configured',
      );
    const result = await this.configured(id);
    if (!this.supportsTask(result.model, task))
      throw new ServiceUnavailableException(
        'AI model does not support this task',
      );
    if (
      !result.model.access.allowedPlans.includes(plan) ||
      (requested && !result.model.access.selectable)
    )
      throw new ForbiddenException('AI model is not available for your plan');
    if (
      plan === UserPlan.FREE &&
      !this.adapters.supportsFreeAuto(result.provider.adapter)
    )
      throw new ServiceUnavailableException(
        'Free Auto routing requires Gemini',
      );
    return { ...result, plan, auto: !requested };
  }
  async available(userId: string, task: AITask = AI_TASK.EDIT_PLANNING) {
    const plan = await this.entitlement(userId);
    const route = await this.routing.findById(AI_ROUTING.LEGACY_DEFAULT);
    const ids = await this.models
      .find({
        enabled: true,
        archived: false,
        'access.allowedPlans': plan,
        ...(plan === UserPlan.FREE
          ? { _id: route?.modelId ?? null }
          : {
              $or: [
                { 'access.selectable': true },
                { _id: route?.modelId ?? null },
              ],
            }),
      })
      .sort({ priority: 1, _id: 1 })
      .limit(AI_LIMITS.MAX_MODEL_LIST);
    const models: {
      id: string;
      displayName: string;
      description?: string;
      provider: string;
      selectable: boolean;
      capabilities: AIModel['capabilities'];
    }[] = [];
    for (const model of ids) {
      if (!this.supportsTask(model, task)) continue;
      try {
        const usable = await this.configured(String(model._id));
        models.push({
          id: String(model._id),
          displayName: model.displayName,
          description: model.description,
          provider: usable.provider.code,
          selectable: model.access.selectable,
          capabilities: model.capabilities,
        });
      } catch (error) {
        if (!(
          error instanceof ServiceUnavailableException ||
          error instanceof NotFoundException
        ))
          throw error;
      }
    }
    return {
      plan,
      selectionAllowed: plan !== UserPlan.FREE,
      compatibilityMode: task === AI_TASK.HIGHLIGHT_DETECTION && !route,
      defaultModelId: models.some((m) => m.id === route?.modelId)
        ? route?.modelId
        : null,
      models,
    };
  }
  async recordUsage(input: AIUsage) {
    await this.usage.updateOne(
      { executionId: input.executionId, call: input.call },
      { $setOnInsert: input },
      { upsert: true },
    );
  }
}

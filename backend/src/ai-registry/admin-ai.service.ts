import { HighlightsResponseSchema } from '../media/highlight-result.contract';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import type { AIUsage } from './registry.schemas';
import { z } from 'zod';
import { objectId, parseEdit } from '../ai-editor/edit-plan.contract';
import { ActivitiesService } from '../activities/activities.service';
import {
  ActivityActorType,
  ActivityCategory,
  ActivityType,
  ActivityStatus,
} from '../activities/schemas/activity.schema';
import { CredentialVault } from './credential-vault.service';
import { ModelRegistry } from './model-registry.service';
import { ProviderAdapterRegistry } from './provider-adapter.registry';
import { ProviderValidationService } from './provider-validation.service';
import {
  AI_ROUTING,
  AI_LIMITS,
  providerEndpoint,
  providerRevisionFilter,
  providerConfigurationHash,
} from './provider-policy';
import { PAGINATION, AI_TASK } from '@blynta/types/contracts';
import {
  credentialInput,
  credentialUpdate,
  listInput,
  modelInput,
  providerInput,
  providedFields,
} from './registry.contract';

@Injectable()
export class AdminAIService {
  constructor(
    private registry: ModelRegistry,
    private vault: CredentialVault,
    private adapters: ProviderAdapterRegistry,
    private activities: ActivitiesService,
    private validation: ProviderValidationService,
  ) {}
  private async audit(actor: string, action: string, id?: string) {
    await this.activities.create({
      userId: actor,
      actorId: actor,
      actorType: ActivityActorType.ADMIN,
      category: ActivityCategory.SYSTEM,
      type: ActivityType.SYSTEM_EVENT,
      title: 'AI administration attempt: ' + action,
      description:
        'Authorized management request; this audit intent does not certify the subsequent write outcome.',
      status: ActivityStatus.PENDING,
      entityType: 'ai_configuration',
      metadata: { action, recordId: id },
    });
  }
  private id(id: string) {
    return parseEdit(objectId, id);
  }
  adapterOptions() {
    return { items: this.adapters.options() };
  }
  async list(kind: 'providers' | 'models' | 'usage', query: unknown) {
    const q = parseEdit(listInput, query);
    const filter: Record<string, unknown> = {};
    if (q.enabled !== undefined && kind !== 'usage')
      filter.enabled = q.enabled === 'true';
    if (q.providerId) filter.providerId = q.providerId;
    if (q.search && kind !== 'usage')
      filter[kind === 'models' ? 'displayName' : 'name'] = {
        $regex: q.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        $options: 'i',
      };
    if (kind === 'providers') {
      const items = await this.registry.providers
        .find(filter)
        .sort({ _id: 1 })
        .skip((q.page - 1) * PAGINATION.DEFAULT_PAGE_SIZE)
        .limit(PAGINATION.DEFAULT_PAGE_SIZE)
        .lean();
      return {
        items: await Promise.all(
          items.map(async (p) => ({
            ...p,
            configured: !!(await this.registry.credentials.exists({
              _id: p.defaultCredentialId ?? null,
              providerId: String(p._id),
              enabled: true,
            })),
            modelCount: await this.registry.models.countDocuments({
              providerId: String(p._id),
              archived: false,
            }),
            operationalAdapter: this.adapters.supports(p.adapter),
          })),
        ),
        page: q.page,
        pageSize: PAGINATION.DEFAULT_PAGE_SIZE,
      };
    }
    if (kind === 'models') {
      const route = await this.registry.routing.findById(
        AI_ROUTING.LEGACY_DEFAULT,
      );
      const items = await this.registry.models
        .find({ ...filter, archived: false })
        .sort({ priority: 1, _id: 1 })
        .skip((q.page - 1) * PAGINATION.DEFAULT_PAGE_SIZE)
        .limit(PAGINATION.DEFAULT_PAGE_SIZE)
        .lean();
      return {
        items: items.map((m) => ({
          ...m,
          isDefault: String(m._id) === route?.modelId,
        })),
        page: q.page,
        pageSize: PAGINATION.DEFAULT_PAGE_SIZE,
      };
    }
    const items = await this.registry.usage
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((q.page - 1) * PAGINATION.DEFAULT_PAGE_SIZE)
      .limit(PAGINATION.DEFAULT_PAGE_SIZE)
      .lean();
    const summary: unknown[] = await this.registry.usage.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$modelId',
          requests: { $sum: 1 },
          successes: {
            $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] },
          },
          failures: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
          inputTokens: { $sum: '$inputTokens' },
          outputTokens: { $sum: '$outputTokens' },
          estimatedCostUsd: { $sum: '$estimatedCostUsd' },
          pricedRequests: {
            $sum: { $cond: [{ $isNumber: '$estimatedCostUsd' }, 1, 0] },
          },
          averageLatencyMs: { $avg: '$latencyMs' },
        },
      },
    ]);
    return {
      items,
      summary,
      page: q.page,
      pageSize: PAGINATION.DEFAULT_PAGE_SIZE,
    };
  }
  async provider(actor: string, body: unknown, id?: string) {
    const input = id
      ? providedFields(parseEdit(providerInput.partial(), body), body)
      : parseEdit(providerInput, body);
    if (
      input.enabled &&
      input.adapter &&
      !this.adapters.supports(input.adapter)
    )
      throw new BadRequestException('Adapter is not implemented');
    let providerRevisionChanged = false;
    let endpointFields: Record<string, unknown> = {};
    if (!id && this.adapters.supports(input.adapter!))
      endpointFields = providerEndpoint(
        input as import('./registry.schemas').AIProvider,
      );
    if (
      !id &&
      !this.adapters.supports(input.adapter!) &&
      (input.baseUrl || input.apiVersion)
    )
      throw new BadRequestException(
        'Endpoint configuration requires an implemented adapter',
      );
    if (id) {
      this.id(id);
      const current = await this.registry.providers.findById(id);
      if (!current) throw new NotFoundException('Provider not found');
      if (this.adapters.supports(current.adapter)) {
        endpointFields = providerEndpoint({
          adapter: current.adapter,
          baseUrl: input.baseUrl ?? current.baseUrl,
          apiVersion: input.apiVersion ?? current.apiVersion,
        });
        providerRevisionChanged = [
          'baseUrl',
          'apiVersion',
          'defaultCredentialId',
          'settings',
        ].some(
          (key) =>
            key in input &&
            JSON.stringify(input[key]) !== JSON.stringify(current[key]),
        );
      } else if (input.baseUrl || input.apiVersion)
        throw new BadRequestException(
          'Endpoint configuration requires an implemented adapter',
        );
      if (input.adapter && input.adapter !== current.adapter)
        throw new ConflictException('Provider adapter is immutable');
      if (input.enabled && !this.adapters.supports(current.adapter))
        throw new BadRequestException('Adapter is not implemented');
      if (
        input.defaultCredentialId &&
        !(await this.registry.credentials.exists({
          _id: input.defaultCredentialId,
          providerId: id,
          enabled: true,
        }))
      )
        throw new BadRequestException(
          'Credential is unavailable for this provider',
        );
    } else if (input.defaultCredentialId)
      throw new BadRequestException(
        'Create provider before assigning its credential',
      );
    await this.audit(actor, id ? 'provider.update' : 'provider.create', id);
    if (id && providerRevisionChanged)
      await this.registry.providers.updateOne(
        { _id: id, revision: { $exists: false } },
        { $set: { revision: 1 } },
      );
    return id
      ? this.registry.providers.findByIdAndUpdate(
          id,
          {
            $set: { ...input, ...endpointFields },
            ...(providerRevisionChanged ? { $inc: { revision: 1 } } : {}),
          },
          { new: true },
        )
      : this.registry.providers.create({ ...input, ...endpointFields });
  }
  async credentials(providerId: string) {
    this.id(providerId);
    return {
      items: await this.registry.credentials
        .find({ providerId, archived: { $ne: true } })
        .sort({ _id: 1 })
        .limit(100)
        .lean(),
      secretMask: '••••••••',
    };
  }
  async addCredential(actor: string, providerId: string, body: unknown) {
    this.id(providerId);
    if (!(await this.registry.providers.exists({ _id: providerId })))
      throw new NotFoundException('Provider not found');
    const input = parseEdit(credentialInput, body);
    const id = new Types.ObjectId();
    const encrypted = this.vault.encrypt(
      input.secret,
      providerId + ':' + String(id),
    );
    await this.audit(actor, 'credential.create', String(id));
    await this.registry.credentials.create({
      _id: id,
      providerId,
      label: input.label,
      enabled: input.enabled,
      createdBy: actor,
      ...encrypted,
    });
    return this.registry.credentials.findById(id);
  }
  async replaceCredential(actor: string, id: string, body: unknown) {
    this.id(id);
    const input = providedFields(parseEdit(credentialUpdate, body), body);
    const c = await this.registry.credentials.findById(id);
    if (!c) throw new NotFoundException('Credential not found');
    if (c.archived) throw new ConflictException('Credential is archived');
    const changes = {
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.secret
        ? {
            ...this.vault.encrypt(input.secret, c.providerId + ':' + id),
            lastValidationStatus: 'unknown',
          }
        : {}),
    };
    await this.audit(actor, 'credential.update', id);
    return this.registry.credentials
      .findOneAndUpdate(
        { _id: id, revision: c.revision },
        { $set: changes, $inc: { revision: 1 } },
        { new: true },
      )
      .orFail(
        () =>
          new ConflictException('Credential changed; reload before replacing'),
      );
  }
  async deleteCredential(actor: string, id: string) {
    this.id(id);
    if (
      (await this.registry.providers.exists({ defaultCredentialId: id })) ||
      (await this.registry.models.exists({ credentialId: id }))
    )
      throw new ConflictException(
        'Credential is referenced; disable it instead',
      );
    await this.audit(actor, 'credential.delete', id);
    // Archive rather than destroy a cipher that a concurrent configuration write may reference.
    await this.registry.credentials.updateOne(
      { _id: id },
      { $set: { enabled: false, archived: true }, $inc: { revision: 1 } },
    );
    return { removed: true };
  }
  async validateCredential(actor: string, id: string) {
    this.id(id);
    await this.audit(actor, 'credential.validate', id);
    return this.validation.validate(id);
  }
  async model(actor: string, body: unknown, id?: string) {
    const input = id
      ? providedFields(parseEdit(modelInput.partial(), body), body)
      : parseEdit(modelInput, body);
    const prior = id
      ? await this.registry.models.findById(this.id(id))
      : undefined;
    if (id && !prior) throw new NotFoundException('Model not found');
    const providerId = input.providerId ?? prior?.providerId;
    const provider = await this.registry.providers.findOne({
      _id: providerId,
    });
    if (!provider || !this.adapters.supports(provider.adapter))
      throw new BadRequestException(
        'Only the implemented Google adapter supports models',
      );
    const credentialId =
      input.credentialId !== undefined
        ? input.credentialId
        : prior?.credentialId;
    if (
      credentialId &&
      !(await this.registry.credentials.exists({
        _id: credentialId,
        providerId,
      }))
    )
      throw new BadRequestException('Credential does not belong to provider');
    const invalidatesTest = [
      'providerId',
      'credentialId',
      'modelId',
      'settings',
      'capabilities',
      'tasks',
    ].some((k) => k in input);
    await this.audit(actor, id ? 'model.update' : 'model.create', id);
    return id
      ? this.registry.models.findByIdAndUpdate(
          id,
          {
            $set: {
              ...input,
              ...(invalidatesTest ? { lastTestStatus: 'unknown' } : {}),
            },
          },
          { new: true },
        )
      : this.registry.models.create({
          ...input,
          archived: false,
          lastTestStatus: 'unknown',
        });
  }
  async getModel(id: string) {
    return this.registry.models
      .findById(this.id(id))
      .orFail(() => new NotFoundException('Model not found'));
  }
  async archive(actor: string, id: string) {
    this.id(id);
    if (await this.registry.routing.exists({ modelId: id }))
      throw new ConflictException('Set another default before archiving');
    await this.audit(actor, 'model.archive', id);
    return this.registry.models.findByIdAndUpdate(
      id,
      { $set: { archived: true, enabled: false } },
      { new: true },
    );
  }
  async setDefault(actor: string, id: string) {
    const { model } = await this.registry.configured(id);
    if (!model.access.allowedPlans.includes('free'))
      throw new BadRequestException('Default must allow free users');
    await this.audit(actor, 'model.default', id);
    // One routing document: concurrent admins cannot create two defaults.
    return this.registry.routing.findOneAndUpdate(
      { _id: AI_ROUTING.LEGACY_DEFAULT },
      { $set: { modelId: id }, $inc: { revision: 1 } },
      { upsert: true, new: true },
    );
  }
  async test(actor: string, id: string) {
    const { model, provider, credential, secret } =
      await this.registry.configured(id, false);
    await this.audit(actor, 'model.test', id);
    const started = Date.now();
    const before = model.toObject();
    const usage: AIUsage = {
      executionId: randomUUID(),
      call: 1,
      userId: actor,
      modelId: id,
      providerModelId: model.modelId,
      providerId: model.providerId,
      taskType: 'admin_model_test',
      pricing: model.pricing,
      latencyMs: 0,
      status: 'failed',
    };
    let valid = false;
    try {
      const signal = AbortSignal.timeout(model.settings.timeoutMs);
      const adapter = this.adapters.get(provider.adapter);
      await adapter.verifyModel(model.modelId, secret, signal, provider);
      const result = model.tasks?.includes(AI_TASK.HIGHLIGHT_DETECTION)
        ? await adapter.structured(
            {
              ...before,
              settings: {
                ...before.settings,
                maxOutputTokens: Math.min(
                  AI_LIMITS.HIGHLIGHT_TEST_OUTPUT_TOKENS,
                  before.settings.maxOutputTokens,
                ),
              },
            },
            secret,
            HighlightsResponseSchema,
            'Return valid video metadata and an empty highlights array.',
            'Highlight schema connectivity test; do not invent a video or timestamps.',
            signal,
            provider,
          )
        : await adapter.structured(
            {
              ...before,
              settings: {
                ...before.settings,
                maxOutputTokens: AI_LIMITS.TEST_OUTPUT_TOKENS,
              },
            },
            secret,
            z.object({ ok: z.boolean() }).strict(),
            'Return ok true.',
            'Connectivity test.',
            signal,
            provider,
          );
      valid =
        !!result.parsed &&
        ('ok' in result.parsed
          ? result.parsed.ok === true
          : Array.isArray(result.parsed.highlights));
      usage.inputTokens = result.usage?.input_tokens;
      usage.outputTokens = result.usage?.output_tokens;
      usage.totalTokens = result.usage?.total_tokens;
      if (
        model.pricing &&
        usage.inputTokens !== undefined &&
        usage.outputTokens !== undefined
      )
        usage.estimatedCostUsd =
          (usage.inputTokens * model.pricing.inputCostPerMillionTokens +
            usage.outputTokens * model.pricing.outputCostPerMillionTokens) /
          1000000;
    } catch {
      valid = false;
    }
    const fresh = await this.registry.credentials.exists({
      _id: credential._id,
      revision: credential.revision,
      enabled: true,
    });
    const providerFresh = await this.registry.providers.exists({
      _id: provider._id,
      enabled: true,
      ...providerRevisionFilter(provider.revision),
    });
    valid = valid && !!fresh && !!providerFresh;
    usage.latencyMs = Date.now() - started;
    usage.status = valid ? 'success' : 'failed';
    await this.registry.recordUsage(usage);
    await this.registry.models.updateOne(
      {
        _id: id,
        modelId: before.modelId,
        settings: before.settings,
        capabilities: before.capabilities,
        tasks: before.tasks,
        credentialId: before.credentialId,
        providerId: before.providerId,
      },
      {
        $set: {
          lastTestedAt: new Date(),
          lastTestStatus: valid ? 'valid' : 'invalid',
          testedCredentialId: String(credential._id),
          testedCredentialRevision: credential.revision,
          testedProviderRevision: provider.revision ?? 1,
          testedProviderConfigurationHash: providerConfigurationHash(provider),
        },
      },
    );
    return { valid, latencyMs: Date.now() - started };
  }
}

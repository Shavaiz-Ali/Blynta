import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AI_ERROR_CODES } from '@blynta/types/contracts';
import { artifactHash } from '../media/pipeline-cache-identity';
import { ModelRegistry, secretSelection } from './model-registry.service';
import { CredentialVault } from './credential-vault.service';
import type { AIModel, AIProvider } from './registry.schemas';
import { ProviderAdapterRegistry } from './provider-adapter.registry';
import {
  AI_LIMITS,
  providerEndpoint,
  providerRevisionFilter,
  providerConfigurationHash,
  AI_ROUTING,
} from './provider-policy';
import {
  classifyProviderFailure,
  credentialWasRejected,
  validationOutcome,
} from './provider-errors';
@Injectable()
export class ProviderValidationService {
  constructor(
    private registry: ModelRegistry,
    private vault: CredentialVault,
    private adapters: ProviderAdapterRegistry,
    private config: ConfigService,
  ) {}
  private async targetModel(
    provider: AIProvider,
    providerId: string,
    credentialId: string,
  ) {
    const eligible = {
      providerId,
      enabled: true,
      archived: { $ne: true },
      'capabilities.text': true,
      $or: [
        { credentialId },
        ...(provider.defaultCredentialId === credentialId
          ? [{ credentialId: null }]
          : []),
      ],
    };
    const route = await this.registry.routing.findById(
      AI_ROUTING.LEGACY_DEFAULT,
    );
    if (route) {
      const routed = await this.registry.models.findOne({
        ...eligible,
        _id: route.modelId,
      });
      if (routed) return routed;
    }
    const model = await this.registry.models
      .findOne(eligible)
      .sort({ priority: 1, _id: 1 });
    return model ?? undefined;
  }
  private modelConfiguration(model: AIModel | undefined) {
    return model
      ? artifactHash({
          modelId: model.modelId,
          credentialId: model.credentialId,
          maxOutputTokens: model.settings.maxOutputTokens,
          temperature: model.settings.temperature,
          timeoutMs: model.settings.timeoutMs,
        })
      : undefined;
  }
  async validate(id: string) {
    const credential = await this.registry.credentials
      .findOne({ _id: id, enabled: true, archived: { $ne: true } })
      .select(secretSelection);
    const provider =
      credential &&
      (await this.registry.providers.findOne({
        _id: credential.providerId,
        enabled: true,
      }));
    if (!credential || !provider)
      throw new BadRequestException('Credential/provider is unavailable');
    const credentialId = String(credential._id);
    const adapter = this.adapters.get(provider.adapter);
    providerEndpoint(provider);
    const model = await this.targetModel(
      provider,
      credential.providerId,
      credentialId,
    );
    const modelId = model?.modelId;
    const context = artifactHash({
      strategy: 'sdk-generate-content-v2',
      modelConfiguration: this.modelConfiguration(model),
      modelId,
      providerId: credential.providerId,
      provider: providerConfigurationHash(provider),
      providerRevision: provider.revision ?? 1,
      credentialId,
      credentialRevision: credential.revision,
    });
    const started = Date.now();
    let result: Awaited<ReturnType<typeof adapter.validateCredential>> = {
      valid: false,
      code: AI_ERROR_CODES.PROVIDER_FAILED,
      message: 'Credential validation did not complete.',
    };
    let secret: string | undefined;
    try {
      secret = this.vault.decrypt(
        credential,
        credential.providerId + ':' + credentialId,
      );
    } catch {
      result = {
        valid: false,
        code: AI_ERROR_CODES.CREDENTIAL_DECRYPT_FAILED,
        message:
          'Backend could not decrypt this credential. Check AI_CREDENTIAL_KEYS and preserve the version used when it was saved.',
      };
    }
    if (secret !== undefined) {
      try {
        if (!modelId) {
          result = {
            valid: false,
            code: AI_ERROR_CODES.REQUEST_FAILED,
            message:
              'Bind an enabled text model to this credential, directly or through its provider default, before testing model access. Credential identity is undetermined.',
          };
        } else if (
          credential.lastValidationStatus === 'valid' &&
          credential.lastValidationContext === context &&
          credential.lastSuccessfulValidationAt &&
          Date.now() - credential.lastSuccessfulValidationAt.getTime() >= 0 &&
          Date.now() - credential.lastSuccessfulValidationAt.getTime() <
            AI_LIMITS.CREDENTIAL_SUCCESS_TTL_MS
        ) {
          return {
            valid: true,
            ...validationOutcome({ valid: true }),
            latencyMs: Date.now() - started,
            cached: true,
            modelId,
          };
        } else {
          result = await adapter.validateCredential(
            provider,
            secret,
            AbortSignal.timeout(
              Math.min(
                model.settings.timeoutMs ?? AI_LIMITS.CREDENTIAL_TIMEOUT_MS,
                provider.settings?.timeoutMs ??
                  this.config.get<number>(
                    'AI_CREDENTIAL_TIMEOUT_MS',
                    AI_LIMITS.CREDENTIAL_TIMEOUT_MS,
                  ),
              ),
            ),
            model,
          );
        }
      } catch (error) {
        result = { valid: false, ...classifyProviderFailure(error, true) };
      }
    }
    const fresh = await this.registry.providers.exists({
      _id: provider._id,
      enabled: true,
      ...providerRevisionFilter(provider.revision),
    });
    if (!fresh)
      result = {
        valid: false,
        code: AI_ERROR_CODES.PROVIDER_FAILED,
        message:
          'Provider configuration changed during validation. Retry with the current configuration.',
      };
    const modelFresh =
      !modelId ||
      this.modelConfiguration(model) ===
        this.modelConfiguration(
          await this.targetModel(provider, credential.providerId, credentialId),
        );
    if (!modelFresh)
      result = {
        valid: false,
        code: AI_ERROR_CODES.REQUEST_FAILED,
        message:
          'The configured validation model changed during the request. Retry with the current configuration.',
      };
    const attemptStatus = result.valid
      ? 'valid'
      : credentialWasRejected(result)
        ? 'invalid'
        : 'error';
    const preserveValid =
      credential.lastValidationStatus === 'valid' && attemptStatus === 'error';
    const update = await this.registry.credentials.updateOne(
      {
        _id: id,
        revision: credential.revision,
        lastValidatedAt: credential.lastValidatedAt ?? null,
        enabled: true,
        archived: { $ne: true },
      },
      {
        $set: {
          lastValidatedAt: new Date(),
          lastValidationStatus: preserveValid ? 'valid' : attemptStatus,
          lastValidationAttemptStatus: attemptStatus,
          lastValidationErrorCode: result.valid
            ? null
            : (result.upstreamReason ??
              result.upstreamErrorStatus ??
              result.code),
          lastValidationMessage: result.valid
            ? null
            : (result.upstreamMessage ?? result.message),
          ...(result.valid
            ? {
                lastSuccessfulValidationAt: new Date(),
                lastValidationContext: context,
              }
            : {}),
        },
      },
    );
    if (update.matchedCount === 0)
      result = {
        valid: false,
        code: AI_ERROR_CODES.PROVIDER_FAILED,
        message:
          'Credential or validation result changed during this request. Reload and retry with the current credential.',
      };
    return {
      ...result,
      ...validationOutcome(result),
      latencyMs: Date.now() - started,
      ...(modelId ? { modelId } : {}),
    };
  }
}

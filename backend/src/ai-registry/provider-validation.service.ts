import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AI_ERROR_CODES } from '@blynta/types/contracts';
import { ModelRegistry, secretSelection } from './model-registry.service';
import { CredentialVault } from './credential-vault.service';
import { ProviderAdapterRegistry } from './provider-adapter.registry';
import {
  AI_LIMITS,
  providerEndpoint,
  providerRevisionFilter,
} from './provider-policy';
import { classifyProviderFailure } from './provider-errors';
@Injectable()
export class ProviderValidationService {
  constructor(
    private registry: ModelRegistry,
    private vault: CredentialVault,
    private adapters: ProviderAdapterRegistry,
    private config: ConfigService,
  ) {}
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
    const adapter = this.adapters.get(provider.adapter);
    providerEndpoint(provider);
    const started = Date.now();
    let result: Awaited<ReturnType<typeof adapter.validateCredential>> = {
      valid: false,
      code: AI_ERROR_CODES.PROVIDER_FAILED,
      message: 'Credential validation did not complete.',
    };
    let secret: string | undefined;
    try {
      secret = this.vault.decrypt(credential, credential.providerId + ':' + id);
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
        result = await adapter.validateCredential(
          provider,
          secret,
          AbortSignal.timeout(
            provider.settings?.timeoutMs ??
              this.config.get<number>(
                'AI_CREDENTIAL_TIMEOUT_MS',
                AI_LIMITS.CREDENTIAL_TIMEOUT_MS,
              ),
          ),
        );
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
    const update = await this.registry.credentials.updateOne(
      {
        _id: id,
        revision: credential.revision,
        enabled: true,
        archived: { $ne: true },
      },
      {
        $set: {
          lastValidatedAt: new Date(),
          lastValidationStatus: result.valid ? 'valid' : 'invalid',
        },
      },
    );
    if (update.matchedCount === 0)
      result = {
        valid: false,
        code: AI_ERROR_CODES.PROVIDER_FAILED,
        message:
          'Credential changed during validation. Retry with the current credential.',
      };
    return { ...result, latencyMs: Date.now() - started };
  }
}

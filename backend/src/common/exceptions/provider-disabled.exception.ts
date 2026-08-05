import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';

export class ProviderDisabledException extends DomainException {
  constructor(provider: string) {
    super(`Provider ${provider} is disabled`, HttpStatus.BAD_REQUEST, 'PROVIDER_DISABLED');
  }
}

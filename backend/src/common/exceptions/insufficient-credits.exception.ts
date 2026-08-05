import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';

export class InsufficientCreditsException extends DomainException {
  constructor() {
    super('Insufficient credits', HttpStatus.CONFLICT, 'INSUFFICIENT_CREDITS');
  }
}

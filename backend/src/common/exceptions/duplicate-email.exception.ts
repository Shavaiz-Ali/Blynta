import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';

export class DuplicateEmailException extends DomainException {
  constructor() {
    super('Email already in use', HttpStatus.CONFLICT, 'DUPLICATE_EMAIL');
  }
}

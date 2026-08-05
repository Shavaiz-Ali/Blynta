import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';

export class InvalidCredentialsException extends DomainException {
  constructor() {
    super('Invalid credentials', HttpStatus.UNAUTHORIZED, 'INVALID_CREDENTIALS');
  }
}

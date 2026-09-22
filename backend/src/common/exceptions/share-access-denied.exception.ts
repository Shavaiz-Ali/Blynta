import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';

export class ShareAccessDeniedException extends DomainException {
  constructor() {
    super(
      'You do not have permission to access this share',
      HttpStatus.FORBIDDEN,
      'SHARE_ACCESS_DENIED',
    );
  }
}

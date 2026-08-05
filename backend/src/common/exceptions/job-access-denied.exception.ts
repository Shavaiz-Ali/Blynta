import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';

export class JobAccessDeniedException extends DomainException {
  constructor() {
    super('You do not have permission to access this job', HttpStatus.FORBIDDEN, 'JOB_ACCESS_DENIED');
  }
}

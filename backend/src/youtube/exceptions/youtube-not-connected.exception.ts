import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/domain.exception';

export class YouTubeNotConnectedException extends DomainException {
  constructor() {
    super(
      'Connect a YouTube account before publishing.',
      HttpStatus.UNPROCESSABLE_ENTITY,
      'YOUTUBE_NOT_CONNECTED',
    );
  }
}

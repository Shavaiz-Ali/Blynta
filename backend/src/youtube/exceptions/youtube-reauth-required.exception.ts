import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/domain.exception';

export class YouTubeReauthRequiredException extends DomainException {
  constructor() {
    super(
      'Your YouTube connection needs to be reauthorized. Please reconnect your YouTube account.',
      HttpStatus.UNAUTHORIZED,
      'YOUTUBE_REAUTH_REQUIRED',
    );
  }
}

import { Module, Global } from '@nestjs/common';
import { PaddleService } from './paddle.service';

@Global()
@Module({
  providers: [PaddleService],
  exports: [PaddleService],
})
export class PaddleModule {}

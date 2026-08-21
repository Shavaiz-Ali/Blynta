import { Global, Module } from '@nestjs/common';
import { ProcessRegistryService } from './services/process-registry.service';

@Global()
@Module({
  providers: [ProcessRegistryService],
  exports: [ProcessRegistryService],
})
export class CommonModule {}

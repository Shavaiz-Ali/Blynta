import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { ProcessRegistryService } from '../../common/services/process-registry.service';
import { TranscriptionService } from './transcription.service';

describe('transcription cache compatibility', () => {
  test('concurrent fingerprints agree and changed local model contents invalidate reuse', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'blynta-model-version-'));
    try {
      const model = join(directory, 'model.bin');
      const binary = join(directory, 'whisper');
      await writeFile(model, 'first model');
      await writeFile(binary, 'first binary');
      const service = new TranscriptionService(
        new ConfigService({
          TRANSCRIPTION_PROVIDER: 'whisper-cpp',
          WHISPER_MODEL_PATH: model,
          WHISPER_BINARY_PATH: binary,
        }),
        {} as ProcessRegistryService,
      );
      const [first, concurrent] = await Promise.all([
        service.cacheConfiguration(),
        service.cacheConfiguration(),
      ]);
      expect(concurrent).toBe(first);
      expect(await service.cacheConfiguration()).toBe(first);
      await writeFile(model, 'different model contents');
      const second = await service.cacheConfiguration();
      expect(second).not.toBe(first);
      await writeFile(binary, 'different binary contents');
      expect(await service.cacheConfiguration()).not.toBe(second);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

import { mkdtemp, rm, writeFile, access } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { R2Service } from '../storage/r2.service';
import { RenderSourceService } from './render-source.service';

describe('concurrent source leases', () => {
  let root: string;
  let sources: RenderSourceService;
  const r2 = {
    downloadToLocal: jest.fn(async (_key: string, path: string) =>
      writeFile(path, 'fixture'),
    ),
  };
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'blynta-source-test-'));
    r2.downloadToLocal.mockClear();
    sources = new RenderSourceService(
      new ConfigService({ STORAGE_ROOT: root }),
      r2 as unknown as R2Service,
    );
  });
  afterEach(async () => {
    await sources.onModuleDestroy();
    await rm(root, { recursive: true, force: true });
  });
  it('coalesces concurrent downloads and does not clean another active clip source', async () => {
    const [one, two] = await Promise.all([
      sources.acquire('a', 'source-a'),
      sources.acquire('a', 'source-a'),
    ]);
    expect(one.path).toBe(two.path);
    expect(r2.downloadToLocal).toHaveBeenCalledTimes(1);
    await one.release(true);
    await expect(access(two.path)).resolves.toBeUndefined();
    await two.release(true);
    await expect(access(two.path)).rejects.toThrow();
  });
  it('isolates different videos and reconstructs after eviction', async () => {
    const [one, two] = await Promise.all([
      sources.acquire('a', 'source-a'),
      sources.acquire('b', 'source-b'),
    ]);
    expect(one.path).not.toBe(two.path);
    await one.release(true);
    await expect(access(two.path)).resolves.toBeUndefined();
    const retry = await sources.acquire('a', 'source-a');
    expect(retry.path).not.toBe(one.path);
    expect(r2.downloadToLocal).toHaveBeenCalledTimes(3);
    await retry.release(true);
    await two.release(true);
  });
  it('cleans a failed download and allows an independent retry', async () => {
    r2.downloadToLocal.mockRejectedValueOnce(new Error('network down'));
    await expect(sources.acquire('a', 'source-a')).rejects.toThrow(
      'network down',
    );
    const retry = await sources.acquire('a', 'source-a');
    await expect(access(retry.path)).resolves.toBeUndefined();
    await retry.release(true);
  });
});

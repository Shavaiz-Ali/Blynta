import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { mkdir, mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { R2Service } from '../storage/r2.service';

interface SourceEntry {
  refs: number;
  touched: number;
  ready: Promise<{ directory: string; path: string }>;
}

/** Optional per-process cache. Every miss reconstructs from the durable R2 key. */
@Injectable()
export class RenderSourceService implements OnModuleDestroy {
  private entries = new Map<string, SourceEntry>();
  constructor(
    private config: ConfigService,
    private r2: R2Service,
  ) {}
  async acquire(jobId: string, objectKey: string) {
    const key = `${jobId}/${objectKey}`;
    let entry = this.entries.get(key);
    if (!entry) {
      entry = {
        refs: 0,
        touched: Date.now(),
        ready: this.download(jobId, objectKey),
      };
      this.entries.set(key, entry);
    }
    entry.refs++;
    entry.touched = Date.now();
    const current = entry;
    let released = false;
    const release = async (terminal = false) => {
      if (released) return;
      released = true;
      current.refs--;
      current.touched = Date.now();
      if (terminal && current.refs === 0 && this.entries.get(key) === current) {
        this.entries.delete(key);
        const source = await current.ready.catch(() => undefined);
        if (source)
          await rm(source.directory, { recursive: true, force: true });
      }
    };
    try {
      return { path: (await current.ready).path, release };
    } catch (error) {
      await release(true);
      throw error;
    }
  }
  private async download(jobId: string, objectKey: string) {
    const root = join(
      this.config.get<string>('STORAGE_ROOT', '/var/blynta/storage'),
      'render-sources',
    );
    await mkdir(root, { recursive: true });
    const directory = await mkdtemp(join(root, `${jobId}-${process.pid}-`));
    const path = join(directory, 'source.mp4');
    try {
      await this.r2.downloadToLocal(objectKey, path);
      return { directory, path };
    } catch (error) {
      await rm(directory, { recursive: true, force: true });
      throw error;
    }
  }
  @Cron(CronExpression.EVERY_5_MINUTES)
  async expireIdle() {
    for (const [key, entry] of this.entries) {
      if (entry.refs || Date.now() - entry.touched < 10 * 60 * 1000) continue;
      this.entries.delete(key);
      const source = await entry.ready.catch(() => undefined);
      if (source) await rm(source.directory, { recursive: true, force: true });
    }
  }
  async onModuleDestroy() {
    await Promise.all(
      [...this.entries.values()].map(async (entry) => {
        const source = await entry.ready.catch(() => undefined);
        if (source)
          await rm(source.directory, { recursive: true, force: true });
      }),
    );
    this.entries.clear();
  }
}

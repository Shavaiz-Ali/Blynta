import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { REDIS_CLIENT } from '../../redis/redis.module';
import {
  PipelineArtifact,
  PipelineArtifactDocument,
} from '../../jobs/schemas/pipeline-artifact.schema';
import {
  assertNotCancelled,
  cancellationSignal,
} from '../../jobs/cancellation-context';
import { artifactHash } from '../pipeline-cache-identity';

const LEASE_MS = 90000;
const RENEW =
  "if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('PEXPIRE',KEYS[1],ARGV[2]) else return 0 end";
const RELEASE =
  "if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end";

@Injectable()
export class PipelineCacheService {
  private readonly logger = new Logger(PipelineCacheService.name);
  private readonly lease = new AsyncLocalStorage<() => Promise<void>>();
  constructor(
    @InjectModel(PipelineArtifact.name)
    private readonly artifacts: Model<PipelineArtifactDocument>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {}

  async assertLease(): Promise<void> {
    assertNotCancelled();
    await this.lease.getStore()?.();
  }

  async withLock<T>(identity: string, work: () => Promise<T>): Promise<T> {
    const key = `pipeline:lease:${artifactHash(identity)}`;
    const token = randomUUID();
    const deadline = Date.now() + 20 * 60 * 1000;
    while (!(await this.redis.set(key, token, 'PX', LEASE_MS, 'NX'))) {
      assertNotCancelled();
      if (Date.now() >= deadline)
        throw new Error('Pipeline cache preparation is busy; retry later');
      await delay(500, undefined, { signal: cancellationSignal() });
    }
    let lost = false;
    const renew = async () => {
      if (lost) throw new Error('Pipeline artifact lease lost');
      if (Number(await this.redis.eval(RENEW, 1, key, token, LEASE_MS)) !== 1) {
        lost = true;
        throw new Error('Pipeline artifact lease lost');
      }
    };
    const timer = setInterval(() => {
      void renew().catch(() => {
        lost = true;
      });
    }, LEASE_MS / 3);
    timer.unref();
    try {
      return await this.lease.run(renew, async () => {
        assertNotCancelled();
        const value = await work();
        await this.assertLease();
        return value;
      });
    } finally {
      clearInterval(timer);
      await this.redis.eval(RELEASE, 1, key, token).catch(() =>
        this.logger.warn({
          event: 'cache.lease.release_failed',
          lease: artifactHash(identity),
        }),
      );
    }
  }

  async getOrCreate<T>(params: {
    key: string;
    kind: 'transcript' | 'highlights';
    sourceVersion: string;
    jobId: string;
    metadata?: Record<string, string>;
    validate: (payload: unknown) => payload is T;
    create: () => Promise<T>;
    cacheable?: (payload: T) => boolean;
  }): Promise<T> {
    return this.withLock(params.key, async () => {
      const existing = await this.artifacts
        .findOne({
          key: params.key,
        })
        .lean()
        .exec();
      if (
        existing &&
        existing.kind === params.kind &&
        existing.sourceVersion === params.sourceVersion &&
        new Date(existing.expiresAt).getTime() > Date.now() &&
        params.validate(existing.payload) &&
        params.cacheable?.(existing.payload) !== false &&
        artifactHash(existing.payload) === existing.payloadHash
      ) {
        this.logger.log({
          event: 'cache.hit',
          layer: params.kind,
          jobId: params.jobId,
          key: params.key,
          llmCallsAvoided:
            params.kind === 'highlights'
              ? ((existing.payload as { llmCalls?: number }).llmCalls ?? 1)
              : 0,
          transcriptionCallsAvoided: params.kind === 'transcript' ? 1 : 0,
        });
        return structuredClone(existing.payload);
      }
      this.logger.log({
        event: 'cache.miss',
        layer: params.kind,
        jobId: params.jobId,
        reason: existing
          ? 'expired_incompatible_or_invalid_payload'
          : 'absent_or_incompatible_identity',
      });
      const payload = await params.create();
      if (!params.validate(payload))
        throw new Error(`Invalid ${params.kind} artifact`);
      if (params.cacheable?.(payload) !== false) {
        await this.assertLease();
        // Remove only the exact corrupt/expired record. Successful artifacts stay immutable.
        await this.artifacts
          .deleteOne({
            key: params.key,
            ...(existing
              ? { _id: existing._id }
              : { expiresAt: { $lte: new Date() } }),
          })
          .exec();
        const days = Math.max(
          1,
          this.config.get<number>('PIPELINE_CACHE_TTL_DAYS', 30),
        );
        await this.artifacts
          .updateOne(
            { key: params.key },
            {
              $setOnInsert: {
                key: params.key,
                kind: params.kind,
                sourceVersion: params.sourceVersion,
                payloadHash: artifactHash(payload),
                payload,
                metadata: params.metadata,
                expiresAt: new Date(Date.now() + days * 86400000),
              },
            },
            { upsert: true, runValidators: true },
          )
          .exec();
      }
      return structuredClone(payload);
    });
  }
}

import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import Redis from 'ioredis';
import { PipelineCacheService } from '../src/media/services/pipeline-cache.service';
import { PipelineArtifactDocument } from '../src/jobs/schemas/pipeline-artifact.schema';

type Row = {
  _id: Types.ObjectId;
  key: string;
  kind: string;
  sourceVersion: string;
  payloadHash: string;
  payload: unknown;
  expiresAt: Date;
};
export function cacheFixture() {
  const rows = new Map<string, Row>();
  const locks = new Map<string, string>();
  const redis = {
    set: jest.fn((key: string, token: string) => {
      if (locks.has(key)) return Promise.resolve(null);
      locks.set(key, token);
      return Promise.resolve('OK');
    }),
    eval: jest.fn(
      (script: string, _count: number, key: string, token: string) => {
        if (locks.get(key) !== token) return Promise.resolve(0);
        if (script.includes("'DEL'")) locks.delete(key);
        return Promise.resolve(1);
      },
    ),
  };
  const model = {
    findOne: jest.fn((query: { key: string }) => ({
      lean: () => ({
        exec: () => {
          const row = rows.get(query.key);
          return Promise.resolve(row ?? null);
        },
      }),
    })),
    deleteOne: jest.fn((query: { key: string; _id?: Types.ObjectId }) => ({
      exec: () => {
        const row = rows.get(query.key);
        if (row && (query._id?.equals(row._id) || row.expiresAt <= new Date()))
          rows.delete(query.key);
        return Promise.resolve({ deletedCount: 1 });
      },
    })),
    updateOne: jest.fn(
      (query: { key: string }, update: { $setOnInsert: Omit<Row, '_id'> }) => ({
        exec: () => {
          if (!rows.has(query.key))
            rows.set(query.key, {
              _id: new Types.ObjectId(),
              ...structuredClone(update.$setOnInsert),
            });
          return Promise.resolve({ modifiedCount: 1 });
        },
      }),
    ),
  };
  const cache = new PipelineCacheService(
    model as unknown as Model<PipelineArtifactDocument>,
    redis as unknown as Redis,
    new ConfigService(),
  );
  return { cache, rows, locks, model, redis };
}

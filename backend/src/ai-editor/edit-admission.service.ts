import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { EditAdmission, EditVersion } from './edit.schemas';

@Injectable()
export class EditAdmissionService {
  constructor(
    @InjectModel('EditAdmission') private admissions: Model<EditAdmission>,
  ) {}
  key(
    v: Pick<EditVersion, 'planId' | 'revision' | 'profile'> & {
      generation?: number;
    },
  ) {
    return `${v.planId}-${v.revision}-${v.profile}-${v.generation ?? 0}`;
  }
  async acquire(userId: string, key: string) {
    try {
      await this.admissions.updateOne(
        { _id: userId },
        { $setOnInsert: { active: [] } },
        { upsert: true },
      );
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
    }
    try {
      const row = await this.admissions.findOneAndUpdate(
        {
          _id: userId,
          $or: [
            { active: key },
            { $expr: { $lt: [{ $size: { $ifNull: ['$active', []] } }, 5] } },
          ],
        },
        { $addToSet: { active: key } },
        { new: true },
      );
      if (row) return;
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
    }
    throw new ConflictException(
      'Finish or cancel pending previews before creating another',
    );
  }
  async release(userId: string, key: string) {
    await this.admissions.updateOne(
      { _id: userId, active: key },
      { $pull: { active: key } },
    );
  }
  async reconcile(versions: Model<EditVersion>) {
    const rows = await this.admissions
      .find({
        updatedAt: { $lt: new Date(Date.now() - 60000) },
        active: { $ne: [] },
      })
      .limit(100)
      .lean();
    for (const row of rows)
      for (const key of row.active) {
        const [planId, revision, profile, generation] = key.split('-');
        if (profile !== 'preview') continue;
        const pending = await versions.exists({
          userId: row._id,
          planId,
          revision: Number(revision),
          profile,
          generation: Number(generation),
          status: { $in: ['queued', 'processing'] },
        });
        if (!pending) await this.release(row._id, key);
      }
  }
}

export function editJobId(id: string, generation = 0) {
  return `edit-${id}${generation ? `-${generation}` : ''}`;
}

// Explicit API allowlist: storage keys and execution tokens never leave the server.
export function editView(record: object): Record<string, unknown> {
  const raw =
    'toObject' in record && typeof record.toObject === 'function'
      ? (record as { toObject(): Record<string, unknown> }).toObject()
      : (record as Record<string, unknown>);
  const fields = [
    '_id',
    'planId',
    'revision',
    'schemaVersion',
    'sourceClipId',
    'plan',
    'outputDuration',
    'profile',
    'status',
    'progress',
    'error',
    'errorCode',
    'retryable',
    'renderStats',
    'createdAt',
    'updatedAt',
    'completedAt',
  ];
  const result: Record<string, unknown> = Object.fromEntries(
    fields.filter((k) => raw[k] !== undefined).map((k) => [k, raw[k]]),
  );
  const source = raw.sourceMedia as { jobId?: string } | undefined;
  if (source?.jobId) result.sourceJobId = source.jobId;
  return result;
}

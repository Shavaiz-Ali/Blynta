import { mkdtemp, mkdir, rm, stat, utimes } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { JobsService } from './jobs.service';
import { JobsCompletionService } from './jobs-completion.service';
import { JobsReconciliationService } from './jobs-reconciliation.service';
import { JobStatus } from './schemas/job.schema';

describe('confirmed cancellation workspace retention', () => {
  it('sweeps old cancelled workspaces but preserves pending and unacknowledged workers even without Bull locks', async () => {
    const root = await mkdtemp(join(tmpdir(), 'blynta-sweep-'));
    const parents = [
      {
        _id: new Types.ObjectId(),
        status: JobStatus.CANCELLED,
        activeExecutions: [],
      },
      {
        _id: new Types.ObjectId(),
        status: JobStatus.CANCELLING,
        activeExecutions: ['orphan'],
      },
      {
        _id: new Types.ObjectId(),
        status: JobStatus.FAILED,
        activeExecutions: ['orphan'],
      },
    ];
    const directories: string[] = [];
    try {
      for (const parent of parents) {
        for (const folder of ['jobs', 'renders', 'render-sources']) {
          const directory = join(
            root,
            folder,
            parent._id.toString() + (folder === 'jobs' ? '' : '-workspace'),
          );
          await mkdir(directory, { recursive: true });
          await utimes(directory, new Date(0), new Date(0));
          directories.push(directory);
        }
      }
      const jobs = {
        activeMediaJobIds: () => Promise.resolve(new Set()),
        findAbandonedFailedJobs: () => Promise.resolve(parents),
        findJob: (id: string) =>
          Promise.resolve(
            parents.find((parent) => parent._id.toString() === id),
          ),
      };
      const config = {
        get: (key: string) => (key === 'STORAGE_ROOT' ? root : 'true'),
      };
      const sweep = new JobsReconciliationService(
        jobs as unknown as JobsService,
        {} as JobsCompletionService,
        config as unknown as ConfigService,
      );
      await sweep.sweepAbandonedFailedJobDirs();
      for (const directory of directories.slice(0, 3))
        await expect(stat(directory)).rejects.toThrow();
      for (const directory of directories.slice(3))
        await expect(stat(directory)).resolves.toBeDefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

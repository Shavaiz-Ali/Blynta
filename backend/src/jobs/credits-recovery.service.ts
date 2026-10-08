import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Model, Types } from 'mongoose';
import { Queue } from 'bullmq';
import { CreditsService } from '../billing/credits.service';
import { JobsService } from './jobs.service';
import { JobStatus } from './schemas/job.schema';
import { StudioRender, StudioAsset } from '../studio/studio.schemas';
import { studioPrice } from '../billing/credit-pricing';
import { User, UserDocument, UserPlan } from '../users/schemas/user.schema';

/** Reconcile based on durable job state and queue locks, never elapsed time alone. */
@Injectable()
export class CreditsRecoveryService {
  private logger = new Logger(CreditsRecoveryService.name);
  private cursor?: Types.ObjectId;
  private auditCursor?: Types.ObjectId;
  constructor(
    private credits: CreditsService,
    private jobs: JobsService,
    @InjectModel('StudioRender') private renders: Model<StudioRender>,
    @InjectQueue('studio') private studioQueue: Queue,
    @InjectModel(User.name) private users: Model<UserDocument>,
  ) {}
  @Cron(CronExpression.EVERY_MINUTE)
  async recover() {
    await this.credits.recoverUsage().catch((error) =>
      this.logger.error({
        event: 'billing.usage.recovery.failed',
        error: String(error),
      }),
    );
    if (this.credits.enabled) {
      const freeUsers = await this.users
        .find({
          plan: UserPlan.FREE,
          creditLedgerInitialized: true,
          freeCreditGrantAt: { $lte: new Date() },
        })
        .limit(100);
      for (const user of freeUsers) {
        try {
          await this.credits.grantFreeCycle(String(user._id));
        } catch (error) {
          this.logger.error({
            event: 'billing.free-grant.failed',
            userId: String(user._id),
            error: String(error),
          });
        }
      }
    }
    // Snapshot marker controls reconciliation even when new V2 admission is disabled.
    const operations = await this.credits.operations
      .find({
        status: 'reserved',
        ...(this.cursor ? { _id: { $gt: this.cursor } } : {}),
      })
      .sort({ _id: 1 })
      .limit(100);
    this.cursor = operations.length
      ? operations[operations.length - 1]._id
      : undefined;
    for (const op of operations) {
      try {
        if (op.product === 'ai-clips') {
          await this.jobs.recoverExecutionLeases(op.relatedId);
          const job = await this.jobs.findJob(op.relatedId);
          if (!job) {
            if (Date.now() - op.createdAt.getTime() > 10 * 60_000)
              await this.credits.settle(op.operationId, op.charged);
          } else if (
            [
              JobStatus.COMPLETED,
              JobStatus.FAILED,
              JobStatus.CANCELLED,
            ].includes(job.status)
          )
            await this.jobs.finalizeCredits(op.relatedId);
          else if (job.status === JobStatus.CANCELLING) {
            await this.jobs.finalizeCancellation(op.relatedId);
            await this.jobs.finalizeCredits(op.relatedId);
          } else if (job.pipelineRetryRequested)
            await this.jobs.enqueuePipeline(op.relatedId);
        } else if (op.kind === 'studio-ai') {
          if (op.result !== undefined)
            await this.credits.settle(op.operationId, op.authorized);
          else if (
            Date.now() - (op.executionStartedAt || op.updatedAt).getTime() >
            5 * 60_000
          )
            await this.credits.settle(op.operationId, 0, undefined, {
              generation: op.generation,
              executionToken: op.executionToken,
              missingResult: true,
            }); // Provider request has a 45-second timeout.
        } else if (op.kind === 'studio-transcription') {
          const assets = this.renders.db.model<StudioAsset>('StudioAsset');
          const a = await assets.findById(op.relatedId);
          if (!a) {
            await this.credits.settle(op.operationId, 0);
            continue;
          }
          if (a.transcriptStatus === 'completed') {
            await this.credits.settle(
              op.operationId,
              a.transcript?.length ? op.authorized : 0,
            );
            continue;
          }
          const queueId = `transcribe-${a.projectId}-${a.assetId}`;
          const queued = await this.studioQueue.getJob(queueId);
          if (queued && (await queued.getState()) === 'failed') {
            await assets.updateOne(
              { _id: a._id },
              { $set: { transcriptStatus: 'failed' } },
            );
            await this.credits.settle(op.operationId, 0);
          } else if (!queued) {
            await this.studioQueue.add(
              'transcribe',
              { userId: a.userId, projectId: a.projectId, assetId: a.assetId },
              {
                jobId: queueId,
                attempts: 2,
                removeOnComplete: true,
                removeOnFail: 100,
              },
            );
          }
        } else if (op.product === 'studio') {
          const r = await this.renders.findById(op.relatedId);
          if (!r) {
            if (Date.now() - op.createdAt.getTime() > 10 * 60_000)
              await this.credits.settle(op.operationId, op.charged);
            continue;
          }
          if (r.status === 'completed') {
            await this.credits.settle(
              op.operationId,
              studioPrice(
                Math.max(...r.document.clips.map((c) => c.start + c.duration)),
                op.pricing,
              ),
            );
            continue;
          }
          if (r.status === 'failed') {
            await this.credits.settle(op.operationId, op.charged);
            continue;
          }
          const queued = await this.studioQueue.getJob(op.relatedId);
          if (!queued)
            await this.studioQueue.add(
              'render',
              { renderId: op.relatedId },
              {
                jobId: op.relatedId,
                attempts: 2,
                backoff: { type: 'exponential', delay: 3000 },
                removeOnComplete: true,
                removeOnFail: 100,
              },
            );
          else if ((await queued.getState()) === 'failed') {
            await this.renders.updateOne(
              { _id: r._id, status: { $ne: 'completed' } },
              {
                $set: {
                  status: 'failed',
                  error: 'Export interrupted. Unused credits released.',
                },
              },
            );
          }
        }
      } catch (error) {
        this.logger.error({
          event: 'billing.reconciliation.failed',
          operationId: op.operationId,
          error: String(error),
        });
      }
    }
  }
  @Cron(CronExpression.EVERY_5_MINUTES)
  async auditBalances() {
    const accounts = await this.users
      .find({
        creditLedgerInitialized: true,
        ...(this.auditCursor ? { _id: { $gt: this.auditCursor } } : {}),
      })
      .sort({ _id: 1 })
      .limit(100);
    this.auditCursor = accounts.length
      ? accounts[accounts.length - 1]._id
      : undefined;
    for (const user of accounts) {
      try {
        await this.credits.audit(String(user._id));
      } catch (error) {
        this.logger.error({
          event: 'billing.ledger.audit.failed',
          userId: String(user._id),
          error: String(error),
        });
      }
    }
  }
}

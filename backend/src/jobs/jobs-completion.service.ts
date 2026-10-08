import { Injectable } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { UsersService } from '../users/users.service';
import { JobStatus } from './schemas/job.schema';
import {
  NotificationCategory,
  NotificationType,
} from '../notifications/schemas/notification.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
import { ActivitiesService } from '../activities/activities.service';
import {
  ActivityActorType,
  ActivityCategory,
  ActivitySeverity,
  ActivityStatus,
  ActivityType,
} from '../activities/schemas/activity.schema';

@Injectable()
export class JobsCompletionService {
  constructor(
    private jobsService: JobsService,
    private usersService: UsersService,
    private notificationsService: NotificationsService,
    private mailService: MailService,
    private activitiesService: ActivitiesService,
  ) {}
  async finalize(jobId: string) {
    await this.jobsService.finalizeRenderState(jobId);
    await this.publish(jobId);
  }
  async publish(jobId: string) {
    const finalJob = await this.jobsService.findJob(jobId);
    if (
      !finalJob ||
      finalJob.completionPublished ||
      ![JobStatus.COMPLETED, JobStatus.FAILED].includes(finalJob.status)
    )
      return;
    const user = await this.usersService.findById(finalJob.userId.toString());
    if (!user) throw new Error('Job owner not found');
    const allClipsSucceeded = finalJob.status === JobStatus.COMPLETED;
    const successfulClipCount = finalJob.clips.filter(
      (c) => c.status === JobStatus.COMPLETED,
    ).length;
    // Queue idempotent in-app notifications and emails via BullMQ (never inline)
    if (finalJob) {
      if (allClipsSucceeded) {
        await this.notificationsService.queueCreateIfNotExists({
          userId: finalJob.userId,
          type: NotificationType.SUCCESS,
          category: NotificationCategory.JOB,
          title: 'Your clips are ready',
          message:
            successfulClipCount === 1
              ? '1 clip was successfully generated.'
              : `${successfulClipCount} clips were successfully generated.`,
          actionUrl: `/dashboard/jobs/${jobId}`,
          actionLabel: 'View clips',
          entityType: 'job',
          entityId: jobId,
          dedupeKey: `job:${jobId}:completed`,
        });

        if (user.email) {
          await this.mailService.queueJobCompletedEmail(
            user.email,
            finalJob.videoTitle || 'Your video',
            successfulClipCount,
            jobId,
          );
        }

        // Record Activity: Job completed
        await this.activitiesService.queueCreateIfNotExists({
          userId: finalJob.userId,
          type: ActivityType.JOB_COMPLETE,
          category: ActivityCategory.JOB,
          title: 'Clip generation completed',
          description:
            successfulClipCount === 1
              ? '1 clip was successfully generated.'
              : `${successfulClipCount} clips were successfully generated.`,
          activityUrl: `/dashboard/jobs/${jobId}`,
          entityType: 'job',
          entityId: jobId,
          actorType: ActivityActorType.WORKER,
          isSystem: true,
          status: ActivityStatus.SUCCESS,
          severity: ActivitySeverity.SUCCESS,
          dedupeKey: `activity:job:${jobId}:complete`,
          metadata: {
            clipCount: successfulClipCount,
          },
        });
      } else {
        await this.notificationsService.queueCreateIfNotExists({
          userId: finalJob.userId,
          type: NotificationType.ERROR,
          category: NotificationCategory.JOB,
          title: 'Clip generation failed',
          message:
            successfulClipCount > 0
              ? `${successfulClipCount} clips are ready. You can retry individual failed clips on the video's processing page.`
              : 'We were unable to generate clips from your video. Please try again.',
          actionUrl: `/dashboard/jobs/${jobId}`,
          actionLabel: 'View job',
          entityType: 'job',
          entityId: jobId,
          dedupeKey: `job:${jobId}:failed`,
        });

        if (user.email) {
          await this.mailService.queueJobFailedEmail(
            user.email,
            finalJob.videoTitle || 'Your video',
            jobId,
          );
        }

        // Record Activity: Job failed
        await this.activitiesService.queueCreateIfNotExists({
          userId: finalJob.userId,
          type: ActivityType.JOB_FAIL,
          category: ActivityCategory.JOB,
          title: 'Clip generation failed',
          description:
            successfulClipCount > 0
              ? `${successfulClipCount} clips are ready; remaining clips failed.`
              : 'We were unable to generate clips from your video.',
          activityUrl: `/dashboard/jobs/${jobId}`,
          entityType: 'job',
          entityId: jobId,
          actorType: ActivityActorType.WORKER,
          isSystem: true,
          status: ActivityStatus.FAILED,
          severity: ActivitySeverity.ERROR,
          dedupeKey: `activity:job:${jobId}:fail`,
        });
      }
    }
    await this.jobsService.markCompletionPublished(jobId, finalJob.status);
  }
}

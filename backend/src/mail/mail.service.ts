import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { MAIL_QUEUE, MAIL_JOBS } from './mail.constants';

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 2000,
  },
  removeOnComplete: true,
  removeOnFail: false,
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(@InjectQueue(MAIL_QUEUE) private mailQueue: Queue) {}

  async queueOtpEmail(email: string, otp: string): Promise<void> {
    this.logger.log(`Queueing OTP email to ${email}`);
    await this.mailQueue.add(
      MAIL_JOBS.SEND_OTP,
      { email, otp },
      DEFAULT_JOB_OPTIONS,
    );
  }

  async queuePasswordResetEmail(
    email: string,
    resetToken: string,
  ): Promise<void> {
    this.logger.log(`Queueing password reset email to ${email}`);
    await this.mailQueue.add(
      MAIL_JOBS.SEND_PASSWORD_RESET,
      { email, resetToken },
      DEFAULT_JOB_OPTIONS,
    );
  }

  async queueWelcomeEmail(email: string, name?: string): Promise<void> {
    this.logger.log(`Queueing welcome email to ${email}`);
    await this.mailQueue.add(
      MAIL_JOBS.SEND_WELCOME,
      { email, name },
      DEFAULT_JOB_OPTIONS,
    );
  }

  async queueReferralInviteEmail(
    toEmail: string,
    referrerName: string,
    referralLink: string,
  ): Promise<void> {
    this.logger.log(
      `Queueing referral invite email to ${toEmail} from ${referrerName}`,
    );
    await this.mailQueue.add(
      MAIL_JOBS.SEND_REFERRAL_INVITE,
      { toEmail, referrerName, referralLink },
      DEFAULT_JOB_OPTIONS,
    );
  }

  async queueReferralRewardEmail(
    email: string,
    creditsEarned: number,
    totalCredits: number,
  ): Promise<void> {
    this.logger.log(`Queueing referral reward email to ${email}`);
    await this.mailQueue.add(
      MAIL_JOBS.SEND_REFERRAL_REWARD,
      { email, creditsEarned, totalCredits },
      DEFAULT_JOB_OPTIONS,
    );
  }

  async queueJobCompletedEmail(
    email: string,
    videoTitle: string,
    clipCount: number,
    jobId: string,
  ): Promise<void> {
    this.logger.log(
      `Queueing job completed email for job ${jobId} to ${email}`,
    );
    await this.mailQueue.add(
      MAIL_JOBS.SEND_JOB_COMPLETED,
      { email, videoTitle, clipCount, jobId },
      DEFAULT_JOB_OPTIONS,
    );
  }

  async queueJobFailedEmail(
    email: string,
    videoTitle: string,
    jobId: string,
  ): Promise<void> {
    this.logger.log(`Queueing job failed email for job ${jobId} to ${email}`);
    await this.mailQueue.add(
      MAIL_JOBS.SEND_JOB_FAILED,
      { email, videoTitle, jobId },
      DEFAULT_JOB_OPTIONS,
    );
  }

  async queueSubscriptionActivatedEmail(
    email: string,
    plan: string,
    credits: number,
  ): Promise<void> {
    this.logger.log(
      `Queueing subscription activated email to ${email} for plan ${plan}`,
    );
    await this.mailQueue.add(
      MAIL_JOBS.SEND_SUBSCRIPTION_ACTIVATED,
      { email, plan, credits },
      DEFAULT_JOB_OPTIONS,
    );
  }
}

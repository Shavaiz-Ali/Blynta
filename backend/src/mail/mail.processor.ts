import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { Resend } from 'resend';
import nodemailer, { Transporter } from 'nodemailer';
import { MAIL_QUEUE, MAIL_JOBS } from './mail.constants';
import {
  otpEmailTemplate,
  passwordResetEmailTemplate,
  welcomeEmailTemplate,
  referralInviteEmailTemplate,
  referralRewardEmailTemplate,
  jobCompletedEmailTemplate,
  jobFailedEmailTemplate,
  subscriptionActivatedEmailTemplate,
} from './templates/mail.templates';

@Processor(MAIL_QUEUE, {
  concurrency: 5,
  lockDuration: 30_000,
  stalledInterval: 15_000,
  maxStalledCount: 3,
})
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);
  private resend?: Resend;
  private mailTransporter?: Transporter;
  private readonly mailProvider: string;
  private readonly fromAddress: string;
  private readonly frontendUrl: string;

  constructor(private configService: ConfigService) {
    super();

    this.mailProvider = this.configService.get<string>(
      'MAIL_PROVIDER',
      'resend',
    );
    this.fromAddress = this.configService.get<string>(
      'MAIL_FROM_ADDRESS',
      'Blynta <onboarding@resend.dev>',
    );
    this.frontendUrl = (
      this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000') ||
      'http://localhost:3000'
    ).replace(/\/$/, '');

    if (this.mailProvider === 'gmail') {
      const mailUser = this.configService.get<string>('MAIL_USER');
      const mailPassword = this.configService.get<string>('MAIL_PASSWORD');

      if (!mailUser || !mailPassword) {
        throw new Error(
          'MAIL_USER and MAIL_PASSWORD are required when MAIL_PROVIDER=gmail',
        );
      }

      const mailHost = this.configService.get<string>(
        'MAIL_HOST',
        'smtp.gmail.com',
      );
      const mailPort = this.configService.get<number>('MAIL_PORT', 587);

      this.mailTransporter = nodemailer.createTransport({
        host: mailHost,
        port: mailPort,
        secure: mailPort === 465,
        auth: {
          user: mailUser,
          pass: mailPassword,
        },
      });

      this.logger.log('Mail provider configured: Gmail SMTP');
    } else if (this.mailProvider === 'resend') {
      const apiKey = this.configService.get<string>('RESEND_API_KEY');

      if (!apiKey) {
        throw new Error('RESEND_API_KEY is required when MAIL_PROVIDER=resend');
      }

      this.resend = new Resend(apiKey);
      this.logger.log('Mail provider configured: Resend');
    } else {
      throw new Error(`Unsupported MAIL_PROVIDER: ${this.mailProvider}`);
    }
  }

  private async sendEmail(
    to: string,
    subject: string,
    html: string,
  ): Promise<void> {
    this.logger.log(`Dispatching email to ${to} with subject: "${subject}"`);

    try {
      if (this.mailProvider === 'gmail') {
        if (!this.mailTransporter) {
          throw new Error('Gmail mail transporter is not initialized');
        }

        const response = await this.mailTransporter.sendMail({
          from: this.fromAddress,
          to,
          subject,
          html,
        });

        this.logger.log(
          `Email delivered to ${to} (messageId: ${response.messageId})`,
        );
        return;
      }

      if (this.mailProvider === 'resend') {
        if (!this.resend) {
          throw new Error('Resend client is not initialized');
        }

        const response = await this.resend.emails.send({
          from: this.fromAddress,
          to,
          subject,
          html,
        });

        if (response.error) {
          this.logger.error(
            `Resend API returned error for ${to}: ${response.error.message}`,
            JSON.stringify(response.error),
          );
          throw new Error(`Resend error: ${response.error.message}`);
        }

        this.logger.log(`Email delivered to ${to} (id: ${response.data?.id})`);
        return;
      }

      throw new Error(`Unsupported MAIL_PROVIDER: ${this.mailProvider}`);
    } catch (err: any) {
      this.logger.error(
        `Failed to send email to ${to}: ${err?.message ?? err}`,
      );
      throw err;
    }
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`Processing mail job "${job.name}" (Job ID: ${job.id})`);

    switch (job.name) {
      case MAIL_JOBS.SEND_OTP: {
        const { email, otp } = job.data;
        const { subject, html } = otpEmailTemplate(otp);
        await this.sendEmail(email, subject, html);
        break;
      }

      case MAIL_JOBS.SEND_PASSWORD_RESET: {
        const { email, resetToken } = job.data;
        const resetUrl = `${this.frontendUrl}/reset-password?token=${resetToken}`;
        const { subject, html } = passwordResetEmailTemplate(resetUrl);
        await this.sendEmail(email, subject, html);
        break;
      }

      case MAIL_JOBS.SEND_WELCOME: {
        const { email, name } = job.data;
        const dashboardUrl = `${this.frontendUrl}/dashboard`;
        const { subject, html } = welcomeEmailTemplate(
          name || '',
          dashboardUrl,
        );
        await this.sendEmail(email, subject, html);
        break;
      }

      case MAIL_JOBS.SEND_REFERRAL_INVITE: {
        const { toEmail, referrerName, referralLink } = job.data;
        const { subject, html } = referralInviteEmailTemplate(
          referrerName,
          referralLink,
        );
        await this.sendEmail(toEmail, subject, html);
        break;
      }

      case MAIL_JOBS.SEND_REFERRAL_REWARD: {
        const { email, creditsEarned, totalCredits } = job.data;
        const dashboardUrl = `${this.frontendUrl}/dashboard`;
        const { subject, html } = referralRewardEmailTemplate(
          creditsEarned,
          totalCredits,
          dashboardUrl,
        );
        await this.sendEmail(email, subject, html);
        break;
      }

      case MAIL_JOBS.SEND_JOB_COMPLETED: {
        const { email, videoTitle, clipCount, jobId } = job.data;
        const jobUrl = `${this.frontendUrl}/dashboard/jobs/${jobId}`;
        const { subject, html } = jobCompletedEmailTemplate(
          videoTitle,
          clipCount,
          jobUrl,
        );
        await this.sendEmail(email, subject, html);
        break;
      }

      case MAIL_JOBS.SEND_JOB_FAILED: {
        const { email, videoTitle, jobId } = job.data;
        const retryUrl = `${this.frontendUrl}/dashboard/jobs/${jobId}`;
        const { subject, html } = jobFailedEmailTemplate(videoTitle, retryUrl);
        await this.sendEmail(email, subject, html);
        break;
      }

      case MAIL_JOBS.SEND_SUBSCRIPTION_ACTIVATED: {
        const { email, plan, credits } = job.data;
        const billingUrl = `${this.frontendUrl}/billing`;
        const { subject, html } = subscriptionActivatedEmailTemplate(
          plan,
          credits,
          billingUrl,
        );
        await this.sendEmail(email, subject, html);
        break;
      }

      default:
        throw new Error(`Unknown mail job type: ${job.name}`);
    }
  }
}

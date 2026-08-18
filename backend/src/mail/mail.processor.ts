import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Resend } from 'resend';
import { ConfigService } from '@nestjs/config';
import { MAIL_QUEUE, MAIL_JOBS } from './mail.constants';
import { otpEmailTemplate, passwordResetEmailTemplate, referralInviteEmailTemplate } from './templates/mail.templates';



@Processor(MAIL_QUEUE)
export class MailProcessor extends WorkerHost {
    private resend: Resend;
    private readonly fromAddress: string;


    constructor(private configService: ConfigService) {
        super();
        this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
        this.fromAddress = this.configService.get<string>('MAIL_FROM_ADDRESS', 'Blynta <noreply@yourdomain.com>');
    }

    private async sendEmail(to: string, subject: string, html: string): Promise<void> {
        await this.resend.emails.send({
            from: this.fromAddress,
            to,
            subject,
            html,
        });
    }

    async process(job: Job): Promise<void> {
        switch (job.name) {
            case MAIL_JOBS.SEND_OTP: {
                const { email, otp } = job.data;
                const { subject, html } = otpEmailTemplate(otp);
                await this.sendEmail(email, subject, html);
                break;
            }

            case MAIL_JOBS.SEND_PASSWORD_RESET: {
                const { email, resetToken } = job.data;
                const resetUrl = `${this.configService.get<string>('FRONTEND_URL')}/reset-password?token=${resetToken}`;
                const { subject, html } = passwordResetEmailTemplate(resetUrl);
                await this.sendEmail(email, subject, html);
                break;
            }

            case MAIL_JOBS.SEND_REFERRAL_INVITE: {
                const { toEmail, referrerName, referralLink } = job.data;
                const { subject, html } = referralInviteEmailTemplate(referrerName, referralLink);
                await this.sendEmail(toEmail, subject, html);
                break;
            }

            default:
                throw new Error(`Unknown mail job type: ${job.name}`);
        }
    }
}
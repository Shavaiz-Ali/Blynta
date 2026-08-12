import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { MAIL_QUEUE, MAIL_JOBS } from './mail.constants';

@Injectable()
export class MailService {
    constructor(@InjectQueue(MAIL_QUEUE) private mailQueue: Queue) { }

    async queueOtpEmail(email: string, otp: string) {
        await this.mailQueue.add(MAIL_JOBS.SEND_OTP, { email, otp });
    }

    async queuePasswordResetEmail(email: string, resetToken: string) {
        await this.mailQueue.add(MAIL_JOBS.SEND_PASSWORD_RESET, { email, resetToken });
    }
}
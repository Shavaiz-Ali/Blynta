import { IsEmail } from 'class-validator';

export class SendReferralInviteDto {
    @IsEmail()
    email: string;
}
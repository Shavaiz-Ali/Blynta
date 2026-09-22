import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const SendReferralInviteSchema = z.object({
  email: z.string().email(),
});

export class SendReferralInviteDto extends createZodDto(
  SendReferralInviteSchema,
) {}

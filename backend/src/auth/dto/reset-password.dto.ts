import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const ResetPasswordSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(8),
});

export class ResetPasswordDto extends createZodDto(ResetPasswordSchema) {}

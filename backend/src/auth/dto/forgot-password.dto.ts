import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

export class ForgotPasswordDto extends createZodDto(ForgotPasswordSchema) {}

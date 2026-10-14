import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export class ValidateResetTokenDto extends createZodDto(
  z.object({ token: z.string().max(256) }),
) {}

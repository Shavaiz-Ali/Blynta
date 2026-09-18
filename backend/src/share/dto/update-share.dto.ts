import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const UpdateShareSchema = z.object({
  /** Toggle the share on/off without revoking the token permanently. */
  isActive: z.boolean().optional(),
  /** Update/clear the expiry. Pass null to remove expiry. */
  expiresAt: z
    .string()
    .datetime({ message: 'expiresAt must be a valid ISO-8601 datetime' })
    .refine((val) => new Date(val) > new Date(), {
      message: 'expiresAt must be a future date',
    })
    .nullable()
    .optional(),
});

export class UpdateShareDto extends createZodDto(UpdateShareSchema) {}

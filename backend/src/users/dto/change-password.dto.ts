import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export class ChangePasswordDto extends createZodDto(ChangePasswordSchema) {}

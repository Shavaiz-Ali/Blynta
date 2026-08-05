import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const UpdateUserSchema = z.object({
  name: z.string().max(100).optional(),
});

export class UpdateUserDto extends createZodDto(UpdateUserSchema) {}

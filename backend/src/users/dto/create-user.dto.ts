import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
  ref: z.string().optional(),
  referralCode: z.string().optional(),
});

export class CreateUserDto extends createZodDto(CreateUserSchema) {}

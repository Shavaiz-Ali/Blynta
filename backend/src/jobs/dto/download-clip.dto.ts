import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export class DownloadClipDto extends createZodDto(
  z.object({
    // A new UUID per intentional click, reused by any transport/mutation retry.
    actionId: z.string().uuid(),
  }),
) {}

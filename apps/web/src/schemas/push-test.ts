import { z } from 'zod';

export const adminPushTestSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { message: 'Title cannot be empty' })
    .max(80, { message: 'Title must be 80 characters or fewer' })
    .default('Baci Push Test'),
  body: z
    .string()
    .trim()
    .min(1, { message: 'Body cannot be empty' })
    .max(240, { message: 'Body must be 240 characters or fewer' })
    .default('If you received this, admin push notifications are working.'),
});

export type AdminPushTestInput = z.infer<typeof adminPushTestSchema>;

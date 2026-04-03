import { z } from 'zod';

export const adminPushTestSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { message: 'Title is required' })
    .max(80, { message: 'Title must be 80 characters or fewer' })
    .optional()
    .default('Baci Push Test'),
  body: z
    .string()
    .trim()
    .min(1, { message: 'Body is required' })
    .max(240, { message: 'Body must be 240 characters or fewer' })
    .optional()
    .default('If you received this, admin push notifications are working.'),
});

export type AdminPushTestInput = z.infer<typeof adminPushTestSchema>;

import { z } from 'zod';

export const orderReminderSchema = z.object({
  channel: z.enum(['email', 'whatsapp', 'sms']).optional(),
});

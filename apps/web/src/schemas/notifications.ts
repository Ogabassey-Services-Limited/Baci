import { z } from 'zod';

/**
 * Schema for single notification ID validation
 */
export const notificationIdSchema = z.string().uuid();

export const createNotificationSchema = z
  .object({
    title: z.string().trim().min(1, { message: 'Title is required' }),
    message: z.string().trim().min(1, { message: 'Message is required' }),
    notification_type: z
      .enum(['info', 'success', 'warning', 'error'])
      .optional()
      .default('info'),
    priority: z
      .enum(['low', 'normal', 'high', 'urgent'])
      .optional()
      .default('normal'),
    target_type: z
      .enum(['all', 'specific', 'segment'])
      .optional()
      .default('all'),
    target_merchant_ids: z.array(z.string().uuid()).optional(),
    target_segment: z.enum(['new', 'active', 'at_risk']).optional(),
    channels: z
      .array(z.enum(['in_app', 'banner', 'push']))
      .min(1, { message: 'At least one channel is required' }),
    action_url: z.string().trim().url().optional().nullable(),
    action_label: z.string().trim().optional().nullable(),
    scheduled_for: z.string().datetime().optional().nullable(),
    expires_at: z.string().datetime().optional().nullable(),
    template_id: z.string().uuid().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.target_type === 'specific' && !data.target_merchant_ids?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Target merchant IDs required for specific targeting',
        path: ['target_merchant_ids'],
      });
    }
    if (data.target_type === 'segment' && !data.target_segment) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Target segment required for segment targeting',
        path: ['target_segment'],
      });
    }
  });

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;

import { z } from 'zod';

/**
 * Schema for single notification ID validation
 */
export const notificationIdSchema = z.uuid();

const notificationTargetingSchema = z
  .object({
    target_type: z.enum(['all', 'specific', 'segment']).optional(),
    target_merchant_ids: z.array(z.uuid()).optional(),
    target_segment: z.enum(['new', 'active', 'at_risk']).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.target_type === 'specific' && !data.target_merchant_ids?.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'Target merchant IDs required for specific targeting',
        path: ['target_merchant_ids'],
      });
    }
    if (data.target_type === 'segment' && !data.target_segment) {
      ctx.addIssue({
        code: 'custom',
        message: 'Target segment required for segment targeting',
        path: ['target_segment'],
      });
    }
  });

export const createNotificationSchema = z
  .object({
    title: z.string().trim().min(1, {
      error: 'Title is required',
    }),
    message: z.string().trim().min(1, {
      error: 'Message is required',
    }),
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
    target_merchant_ids: z.array(z.uuid()).optional(),
    target_segment: z.enum(['new', 'active', 'at_risk']).optional(),
    channels: z.array(z.enum(['in_app', 'banner', 'push'])).min(1, {
      error: 'At least one channel is required',
    }),
    action_url: z.string().trim().pipe(z.url()).optional().nullable(),
    action_label: z.string().trim().optional().nullable(),
    scheduled_for: z.iso.datetime().optional().nullable(),
    expires_at: z.iso.datetime().optional().nullable(),
    template_id: z.uuid().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.target_type === 'specific' && !data.target_merchant_ids?.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'Target merchant IDs required for specific targeting',
        path: ['target_merchant_ids'],
      });
    }
    if (data.target_type === 'segment' && !data.target_segment) {
      ctx.addIssue({
        code: 'custom',
        message: 'Target segment required for segment targeting',
        path: ['target_segment'],
      });
    }
  });

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;

/**
 * Schema for PATCH updates: every field optional and NO defaults injected, so
 * partial updates only touch the fields the caller actually sent (a `.partial()`
 * of the create schema would re-apply defaults like notification_type='info').
 */
export const updateNotificationSchema = z.object({
  title: z.string().trim().min(1).optional(),
  message: z.string().trim().min(1).optional(),
  notification_type: z.enum(['info', 'success', 'warning', 'error']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  target_type: z.enum(['all', 'specific', 'segment']).optional(),
  target_merchant_ids: z.array(z.uuid()).optional().nullable(),
  target_segment: z.enum(['new', 'active', 'at_risk']).optional(),
  channels: z
    .array(z.enum(['in_app', 'banner', 'push']))
    .min(1)
    .optional(),
  action_url: z.string().trim().pipe(z.url()).optional().nullable(),
  action_label: z.string().trim().optional().nullable(),
  scheduled_for: z.iso.datetime().optional().nullable(),
  expires_at: z.iso.datetime().optional().nullable(),
});

export const mergedNotificationTargetingSchema = notificationTargetingSchema;

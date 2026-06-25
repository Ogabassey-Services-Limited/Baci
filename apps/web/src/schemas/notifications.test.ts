import { describe, expect, it } from 'vitest';
import {
  createNotificationSchema,
  updateNotificationSchema,
} from './notifications';

const validCreateNotification = {
  title: 'Inventory update',
  message: 'New stock is available.',
  channels: ['in_app'],
} as const;

describe('notification schemas', () => {
  it('accepts trimmed HTTPS action URLs using the Zod 4 URL validator', () => {
    const parsed = createNotificationSchema.safeParse({
      ...validCreateNotification,
      action_url: '  https://usebaci.com/dashboard/orders  ',
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.action_url).toBe(
        'https://usebaci.com/dashboard/orders'
      );
    }
  });

  it('rejects invalid action URLs', () => {
    const parsed = updateNotificationSchema.safeParse({
      action_url: 'not-a-url',
    });

    expect(parsed.success).toBe(false);
  });
});

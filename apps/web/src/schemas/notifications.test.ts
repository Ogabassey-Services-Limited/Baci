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

  it('allows update payloads to clear merchant ID targeting with null', () => {
    const parsed = updateNotificationSchema.safeParse({
      target_merchant_ids: null,
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.target_merchant_ids).toBeNull();
    }
  });

  it('requires merchant IDs for specific create targeting', () => {
    const parsed = createNotificationSchema.safeParse({
      ...validCreateNotification,
      target_type: 'specific',
      target_merchant_ids: [],
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.flatten().fieldErrors.target_merchant_ids).toContain(
        'Target merchant IDs required for specific targeting'
      );
    }
  });

  it('requires a segment for segment create targeting', () => {
    const parsed = createNotificationSchema.safeParse({
      ...validCreateNotification,
      target_type: 'segment',
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.flatten().fieldErrors.target_segment).toContain(
        'Target segment required for segment targeting'
      );
    }
  });

  it('accepts valid targeted create notifications', () => {
    const parsed = createNotificationSchema.safeParse({
      ...validCreateNotification,
      target_type: 'specific',
      target_merchant_ids: ['123e4567-e89b-12d3-a456-426614174000'],
    });

    expect(parsed.success).toBe(true);
  });
});

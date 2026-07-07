import { describe, expect, it } from 'vitest';
import { resolveOrderNotificationRecipient } from './order-notification-recipient';

describe('resolveOrderNotificationRecipient', () => {
  it('normalizes valid customer email values', () => {
    expect(resolveOrderNotificationRecipient(' Customer@Example.COM ')).toEqual(
      {
        ok: true,
        email: 'customer@example.com',
      }
    );
  });

  it.each([
    null,
    undefined,
    '',
    '   ',
  ])('classifies %s as a missing customer email', (value) => {
    expect(resolveOrderNotificationRecipient(value)).toEqual({
      ok: false,
      reason: 'missing_customer_email',
    });
  });

  it('classifies malformed strings as invalid customer email values', () => {
    expect(resolveOrderNotificationRecipient('not an email')).toEqual({
      ok: false,
      reason: 'invalid_customer_email',
    });
  });
});

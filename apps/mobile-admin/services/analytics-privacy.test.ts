import { describe, expect, it } from 'vitest';
import {
  sanitizeAdminAnalyticsCaptureEvent,
  sanitizeAdminAnalyticsProperties,
} from './analytics-privacy';

describe('admin analytics privacy', () => {
  it('redacts sensitive property keys and string values', () => {
    expect(
      sanitizeAdminAnalyticsProperties({
        email: 'owner@example.com',
        note: 'Contact owner@example.com or +234 800 000 0000',
        nested: {
          bankAccountNumber: '1234567890',
          safe: 'visible',
        },
      })
    ).toEqual({
      email: '[Filtered]',
      note: 'Contact [Filtered] or [Filtered]',
      nested: {
        bankAccountNumber: '[Filtered]',
        safe: 'visible',
      },
    });
  });

  it('strips URL queries and credentials before capture', () => {
    expect(
      sanitizeAdminAnalyticsProperties({
        requestUrl: 'https://user:pass@usebaci.com/dashboard?token=secret#x',
        referrer:
          'https://owner@example.com@usebaci.com/path?phone=12345678901',
      })
    ).toEqual({
      requestUrl: 'https://usebaci.com/dashboard',
      referrer: 'https://usebaci.com/path',
    });
  });

  it('preserves business identifiers while filtering PII-like values elsewhere', () => {
    expect(
      sanitizeAdminAnalyticsProperties({
        merchant_id: '6b5cb8a4-5575-456c-b936-8cdfae30db74',
        order_number: '260702195001',
        order_reference: 'ORD-260702-1-9',
        freeform: 'ORD-260702-1-9',
      })
    ).toEqual({
      merchant_id: '6b5cb8a4-5575-456c-b936-8cdfae30db74',
      order_number: '260702195001',
      order_reference: 'ORD-260702-1-9',
      freeform: 'ORD-[Filtered]',
    });
  });

  it('sanitizes capture event property bags consistently', () => {
    expect(
      sanitizeAdminAnalyticsCaptureEvent({
        event: '$exception',
        properties: { phone: '+2348000000000' },
        $set: { support_email: 'support@example.com' },
        $set_once: { first_seen: '2026-07-02T00:00:00.000Z' },
      })
    ).toEqual({
      event: '$exception',
      properties: { phone: '[Filtered]' },
      $set: { support_email: '[Filtered]' },
      $set_once: { first_seen: '2026-07-02T00:00:00.000Z' },
    });
  });
});

import { describe, expect, it } from 'vitest';
import { redactEventPayload } from './event-redaction';

describe('redactEventPayload', () => {
  it('removes sensitive values recursively', () => {
    expect(
      redactEventPayload({
        customer: {
          customerEmail: 'person@example.com',
          id: 'customer-1',
          ph: '+2348000000000',
        },
        customerId: 'customer-1',
        session_id: 'session-1',
        access_token: 'secret',
        fbp: 'tracking-id',
      })
    ).toEqual({ customer: { id: 'customer-1' } });
  });

  it('removes query strings and fragments from URLs', () => {
    expect(
      redactEventPayload({
        page_url: 'https://example.com/product?email=a%40b.com#details',
      })
    ).toEqual({ page_url: 'https://example.com/product' });
  });

  it('removes embedded URL credentials', () => {
    expect(
      redactEventPayload({
        page_url: 'https://user:password@example.com/product?token=private',
      })
    ).toEqual({ page_url: 'https://example.com/product' });
  });

  it('sanitizes camel-case and relative URL fields', () => {
    expect(
      redactEventPayload({
        landingPageUrl: '/pricing?email=person@example.com#signup',
      })
    ).toEqual({ landingPageUrl: '/pricing' });
  });

  it('handles acronym keys and prototype setters safely', () => {
    const payload = JSON.parse(
      '{"__proto__":{"polluted":true},"IPAddress":"203.0.113.1","URLPath":"https://example.com/path?token=private"}'
    ) as Record<string, unknown>;

    expect(redactEventPayload(payload)).toEqual({
      URLPath: 'https://example.com/path',
    });
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it('serializes supported non-plain objects without bypassing redaction', () => {
    expect(
      redactEventPayload({
        capturedAt: new Date('2026-07-14T12:00:00.000Z'),
        labels: new Set(['new', 'sale']),
        metadata: new Map([
          ['campaign', 'summer'],
          ['token', 'private'],
        ]),
      })
    ).toEqual({
      capturedAt: '2026-07-14T12:00:00.000Z',
      labels: ['new', 'sale'],
      metadata: { campaign: 'summer' },
    });
  });
});

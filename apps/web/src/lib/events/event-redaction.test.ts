import { describe, expect, it } from 'vitest';
import { redactEventPayload, sanitizeEventUrl } from './event-redaction';

describe('event redaction facade', () => {
  it('preserves recursive payload redaction through the public facade', () => {
    expect(
      redactEventPayload({
        customer: {
          customerEmail: 'person@example.com',
          id: 'customer-1',
        },
        page_url: 'https://example.com/product?token=private#details',
      })
    ).toEqual({
      customer: { id: 'customer-1' },
      page_url: 'https://example.com/product',
    });
  });

  it('preserves URL sanitization through the public facade', () => {
    expect(
      sanitizeEventUrl(
        'https://user:password@example.com/product?token=private#details'
      )
    ).toBe('https://example.com/product');
  });
});

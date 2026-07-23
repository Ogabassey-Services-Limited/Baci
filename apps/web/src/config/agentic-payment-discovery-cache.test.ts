import { describe, expect, it } from 'vitest';
import { AGENTIC_PAYMENT_DISCOVERY_NO_STORE_HEADERS } from './agentic-payment-discovery-cache';

describe('agentic payment discovery cache headers', () => {
  it('prevents browser and shared CDN caching', () => {
    expect(AGENTIC_PAYMENT_DISCOVERY_NO_STORE_HEADERS).toEqual({
      'Cache-Control': 'no-store, max-age=0, must-revalidate',
      'CDN-Cache-Control': 'no-store',
      'Vercel-CDN-Cache-Control': 'no-store',
    });
  });
});

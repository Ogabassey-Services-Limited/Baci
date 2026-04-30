import { describe, expect, it } from 'vitest';
import { hashIdempotencyRequest } from '@/lib/agentic/idempotency-hash';

describe('hashIdempotencyRequest', () => {
  it('builds a stable hash from the normalized request fingerprint', () => {
    expect(
      hashIdempotencyRequest({
        apiVersion: '2026-04-30',
        body: '{"items":[]}',
        method: 'post',
        pathname: '/api/agentic/checkout_sessions',
      })
    ).toBe('e1353b032dfa81f009582c526450c9dfa7abaf7a3bbe40a91ec6179af490b537');
  });
});

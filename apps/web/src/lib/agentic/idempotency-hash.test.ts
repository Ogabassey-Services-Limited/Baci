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

  it('normalizes HTTP method casing', () => {
    const lower = hashIdempotencyRequest({
      apiVersion: '2026-04-30',
      body: '{"items":[]}',
      method: 'post',
      pathname: '/api/agentic/checkout_sessions',
    });
    const upper = hashIdempotencyRequest({
      apiVersion: '2026-04-30',
      body: '{"items":[]}',
      method: 'POST',
      pathname: '/api/agentic/checkout_sessions',
    });

    expect(lower).toBe(upper);
  });

  it('changes when meaningful fingerprint fields change', () => {
    const base = hashIdempotencyRequest({
      apiVersion: '2026-04-30',
      body: '{"items":[]}',
      method: 'post',
      pathname: '/api/agentic/checkout_sessions',
    });
    const changed = hashIdempotencyRequest({
      apiVersion: '2026-04-30',
      body: '{"items":[{"id":"product-1"}]}',
      method: 'post',
      pathname: '/api/agentic/checkout_sessions',
    });
    const changedVersion = hashIdempotencyRequest({
      apiVersion: '2026-05-01',
      body: '{"items":[]}',
      method: 'post',
      pathname: '/api/agentic/checkout_sessions',
    });
    const changedPathname = hashIdempotencyRequest({
      apiVersion: '2026-04-30',
      body: '{"items":[]}',
      method: 'post',
      pathname: '/api/agentic/checkout_sessions/agentic_session_1',
    });

    expect(changed).not.toBe(base);
    expect(changedVersion).not.toBe(base);
    expect(changedPathname).not.toBe(base);
    expect(changed).not.toBe(changedVersion);
    expect(changed).not.toBe(changedPathname);
    expect(changedVersion).not.toBe(changedPathname);
  });
});

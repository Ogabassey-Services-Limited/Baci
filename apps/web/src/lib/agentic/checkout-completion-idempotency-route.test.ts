import { describe, expect, it } from 'vitest';
import { CHECKOUT_COMPLETION_IDEMPOTENCY_ROUTE } from './checkout-completion-idempotency-route';

describe('checkout completion idempotency route', () => {
  it('uses the canonical completion route key', () => {
    expect(CHECKOUT_COMPLETION_IDEMPOTENCY_ROUTE).toBe(
      'checkout_sessions.complete'
    );
  });
});

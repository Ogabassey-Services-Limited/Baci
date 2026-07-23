import { describe, expect, it } from 'vitest';
import { WALLET_ORDER_FUNDING_TELEMETRY } from '@/lib/posthog/wallet-order-funding-events';

describe('WALLET_ORDER_FUNDING_TELEMETRY', () => {
  it('pins the snake_case event names the funnel is built on', () => {
    expect(WALLET_ORDER_FUNDING_TELEMETRY.events).toEqual({
      fallback: 'wallet_order_funding_fallback',
      intentCreated: 'wallet_order_funding_intent_created',
      uncertain: 'wallet_order_funding_uncertain',
    });
  });

  it('keeps the vocabulary snake_case', () => {
    for (const event of Object.values(WALLET_ORDER_FUNDING_TELEMETRY.events)) {
      expect(event).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });
});

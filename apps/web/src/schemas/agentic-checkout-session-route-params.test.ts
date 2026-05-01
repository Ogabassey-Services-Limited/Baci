import { describe, expect, it } from 'vitest';
import { agenticCheckoutSessionRouteParamsSchema } from '@/schemas/agentic-checkout-session-route-params';

describe('agenticCheckoutSessionRouteParamsSchema', () => {
  it.each([
    'agentic_session-1',
    'agentic_session_2',
    'checkout-123',
    'a'.repeat(255),
  ])('accepts %s as an agentic checkout session id', (id) => {
    const result = agenticCheckoutSessionRouteParamsSchema.safeParse({ id });

    expect(result.success).toBe(true);
    expect(result.data?.id).toBe(id);
  });

  it('trims session id route params', () => {
    const result = agenticCheckoutSessionRouteParamsSchema.safeParse({
      id: '  agentic_session-1  ',
    });

    expect(result.success).toBe(true);
    expect(result.data?.id).toBe('agentic_session-1');
  });

  it.each([
    ['empty', ''],
    ['whitespace-only', '   '],
    ['oversized', 'a'.repeat(256)],
    ['unsafe', '../session'],
    ['spaced', 'agentic session'],
  ])('rejects %s session ids', (_label, id) => {
    const result = agenticCheckoutSessionRouteParamsSchema.safeParse({ id });

    expect(result.success).toBe(false);
  });
});

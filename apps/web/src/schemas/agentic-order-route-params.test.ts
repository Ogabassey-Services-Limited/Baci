import { describe, expect, it } from 'vitest';
import { agenticOrderRouteParamsSchema } from '@/schemas/agentic-order-route-params';

describe('agenticOrderRouteParamsSchema', () => {
  const validUuid = '11111111-1111-4111-8111-111111111111';

  it.each([
    validUuid,
    '00000000-0000-4000-8000-000000000000',
  ])('accepts %s as an agentic order id', (id) => {
    const result = agenticOrderRouteParamsSchema.safeParse({ id });

    expect(result.success).toBe(true);
    expect(result.data?.id).toBe(id);
  });

  it('trims surrounding whitespace', () => {
    const result = agenticOrderRouteParamsSchema.safeParse({
      id: `  ${validUuid}  `,
    });

    expect(result.success).toBe(true);
    expect(result.data?.id).toBe(validUuid);
  });

  it.each([
    '',
    'order-123',
    '../order-123',
    'a'.repeat(256),
  ])('rejects invalid agentic order id %s', (id) => {
    const result = agenticOrderRouteParamsSchema.safeParse({ id });

    expect(result.success).toBe(false);
  });
});

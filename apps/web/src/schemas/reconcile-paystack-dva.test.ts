import { describe, expect, it } from 'vitest';

import {
  cancelOrdersSchema,
  reconcileArgsSchema,
  uuidSchema,
} from '@/schemas/reconcile-paystack-dva';

describe('uuidSchema', () => {
  it('accepts a valid UUID', () => {
    const result = uuidSchema.safeParse('427ec4ea-b41d-4058-aaf9-3de57ee5fa35');
    expect(result.success).toBe(true);
  });

  it.each([
    ['empty string', ''],
    ['plain text', 'not-a-uuid'],
    ['UUID prefix only', '427ec4ea'],
    ['too long', '427ec4ea-b41d-4058-aaf9-3de57ee5fa3500'],
  ])('rejects %s', (_label, input) => {
    const result = uuidSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/UUID/);
    }
  });
});

describe('cancelOrdersSchema', () => {
  it('returns [] for empty string (single-order recovery)', () => {
    const result = cancelOrdersSchema.safeParse('');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([]);
    }
  });

  it('splits + trims + validates comma-separated UUIDs', () => {
    const result = cancelOrdersSchema.safeParse(
      '  9235a8d5-55fc-4e90-8238-4bb6698679bd , de838a51-d0e9-4438-9f55-135b7677783f '
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([
        '9235a8d5-55fc-4e90-8238-4bb6698679bd',
        'de838a51-d0e9-4438-9f55-135b7677783f',
      ]);
    }
  });

  it('rejects when any entry is not a UUID', () => {
    const result = cancelOrdersSchema.safeParse(
      '9235a8d5-55fc-4e90-8238-4bb6698679bd,not-a-uuid'
    );
    expect(result.success).toBe(false);
  });

  it('drops empty segments from trailing commas', () => {
    const result = cancelOrdersSchema.safeParse(
      '9235a8d5-55fc-4e90-8238-4bb6698679bd,,'
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(['9235a8d5-55fc-4e90-8238-4bb6698679bd']);
    }
  });
});

describe('reconcileArgsSchema', () => {
  const valid = {
    '--transaction-id': '427ec4ea-b41d-4058-aaf9-3de57ee5fa35',
    '--paystack-reference': '100026260509110323000058369193',
    '--canonical-order-id': '211bcf0e-0795-488f-aeeb-52c5b7a8b9ae',
    '--cancel-orders':
      '9235a8d5-55fc-4e90-8238-4bb6698679bd,de838a51-d0e9-4438-9f55-135b7677783f',
    '--operator-user-id': '11111111-1111-4111-8111-111111111111',
  };

  it('parses a fully-valid recovery args object', () => {
    const result = reconcileArgsSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data['--cancel-orders']).toHaveLength(2);
    }
  });

  it('rejects when --paystack-reference is empty', () => {
    const result = reconcileArgsSchema.safeParse({
      ...valid,
      '--paystack-reference': '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path[0]).toBe('--paystack-reference');
    }
  });

  it('rejects when --operator-user-id is not a UUID', () => {
    const result = reconcileArgsSchema.safeParse({
      ...valid,
      '--operator-user-id': 'plain-text',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path[0]).toBe('--operator-user-id');
    }
  });

  it('accepts empty --cancel-orders (single-order recovery shape)', () => {
    const result = reconcileArgsSchema.safeParse({
      ...valid,
      '--cancel-orders': '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data['--cancel-orders']).toEqual([]);
    }
  });
});

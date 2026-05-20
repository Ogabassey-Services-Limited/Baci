import { describe, expect, it } from 'vitest';

import { parseReconcileArgs } from '@/scripts/reconcile-paystack-dva-args';
import { efosaArgs } from '@/scripts/reconcile-paystack-dva-fixtures';

describe('parseReconcileArgs', () => {
  it('parses the full incident argument set into a typed object', () => {
    const result = parseReconcileArgs(efosaArgs);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.args).toEqual({
      transactionId: '427ec4ea-b41d-4058-aaf9-3de57ee5fa35',
      paystackReference: '100026260509110323000058369193',
      canonicalOrderId: '211bcf0e-0795-488f-aeeb-52c5b7a8b9ae',
      cancelOrders: [
        '9235a8d5-55fc-4e90-8238-4bb6698679bd',
        'de838a51-d0e9-4438-9f55-135b7677783f',
        'a259300d-aef4-44f2-9506-22b47fab756d',
      ],
      operatorUserId: '11111111-1111-4111-8111-111111111111',
    });
  });

  it('accepts an empty --cancel-orders value (single-order recovery)', () => {
    const args = [...efosaArgs];
    const idx = args.indexOf('--cancel-orders');
    args[idx + 1] = '';
    const result = parseReconcileArgs(args);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.args.cancelOrders).toEqual([]);
    }
  });

  it('rejects a missing required flag with a descriptive error', () => {
    const result = parseReconcileArgs([
      '--transaction-id',
      '427ec4ea-b41d-4058-aaf9-3de57ee5fa35',
      // --paystack-reference / --canonical-order-id / etc. missing
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/--paystack-reference|--canonical-order-id/);
    }
  });

  it('rejects a malformed UUID via the Zod schema', () => {
    const result = parseReconcileArgs([
      '--transaction-id',
      'not-a-uuid',
      '--paystack-reference',
      'ref',
      '--canonical-order-id',
      '211bcf0e-0795-488f-aeeb-52c5b7a8b9ae',
      '--cancel-orders',
      '',
      '--operator-user-id',
      '11111111-1111-4111-8111-111111111111',
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/--transaction-id/);
      expect(result.error).toMatch(/UUID/);
    }
  });

  it('rejects a non-UUID entry inside --cancel-orders', () => {
    const args = [...efosaArgs];
    const idx = args.indexOf('--cancel-orders');
    args[idx + 1] = '9235a8d5-55fc-4e90-8238-4bb6698679bd,not-a-uuid';
    const result = parseReconcileArgs(args);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/--cancel-orders/);
    }
  });

  it('rejects a malformed flag with no value', () => {
    const result = parseReconcileArgs([
      '--transaction-id',
      // value missing
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/malformed flag/);
    }
  });

  it('rejects an empty --paystack-reference', () => {
    const args = [...efosaArgs];
    const idx = args.indexOf('--paystack-reference');
    args[idx + 1] = '';
    const result = parseReconcileArgs(args);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/--paystack-reference/);
    }
  });
});

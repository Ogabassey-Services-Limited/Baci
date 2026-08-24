import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    '../../supabase/migrations/20260825000000_allow_scoped_order_payment_account_updates.sql'
  ),
  'utf8'
);

describe('order payment account update policy migration', () => {
  it('limits authenticated updates to merchants the caller can access', () => {
    expect(migration).toContain('FOR UPDATE');
    expect(migration).toContain('TO authenticated');
    expect(migration).toContain(
      'public.has_merchant_access(orders.merchant_id)'
    );
    expect(migration).toContain('WITH CHECK');
  });
});

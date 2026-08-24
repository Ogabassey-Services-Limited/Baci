import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    '../../supabase/migrations/20260825003000_scope_order_payment_account_mutations.sql'
  ),
  'utf8'
);

describe('order payment account mutation RPC migration', () => {
  it('removes broad updates and scopes payable refreshes to accessible orders', () => {
    expect(migration).toContain(
      'DROP POLICY IF EXISTS owners_and_staff_update_order_payment_accounts'
    );
    expect(migration).toContain('refresh_paystack_order_payable_amount');
    expect(migration).toContain(
      'public.has_merchant_access(orders.merchant_id)'
    );
    expect(migration).toContain("account.provider = 'paystack'");
  });

  it('serializes account reservations before checking aliases across merchants', () => {
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain("'paystack_order_account:'");
    expect(migration).toContain("RETURN 'conflict'");
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.reserve_paystack_order_payment_account'
    );
  });
});

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
const authoritativeMigration = readFileSync(
  join(
    process.cwd(),
    '../../supabase/migrations/20260825004500_authoritative_paystack_order_account_reservation.sql'
  ),
  'utf8'
);
const crossFlowMigration = readFileSync(
  join(
    process.cwd(),
    '../../supabase/migrations/20260825010000_serialize_paystack_dva_cross_flow_aliases.sql'
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

  it('derives the payable amount under the order lock without caller input', () => {
    expect(authoritativeMigration).toContain("'baci_order_payment:'");
    expect(authoritativeMigration).toContain('FOR UPDATE');
    expect(authoritativeMigration).not.toContain('p_payable_amount');
    expect(authoritativeMigration).toContain(
      "auth.uid(), v_merchant_id, 'orders', 'edit'"
    );
  });

  it('revalidates terminal order state and rejects active wallet accounts', () => {
    expect(authoritativeMigration).toContain("RETURN 'ineligible'");
    expect(authoritativeMigration).toContain(
      'public.customer_wallet_payment_accounts'
    );
    expect(authoritativeMigration).toContain("RETURN 'wallet_conflict'");
  });

  it('serializes order, wallet, and agentic aliases on one account lock', () => {
    expect(crossFlowMigration.match(/paystack_order_account:/g)).toHaveLength(
      3
    );
    expect(crossFlowMigration).toContain(
      'public.customer_wallet_payment_accounts'
    );
    expect(crossFlowMigration).toContain('public.checkout_sessions');
    expect(crossFlowMigration).toContain('public.order_payment_accounts');
    expect(crossFlowMigration).toContain('BEFORE INSERT OR UPDATE OF');
  });
});

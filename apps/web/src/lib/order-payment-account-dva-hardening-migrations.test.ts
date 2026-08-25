import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = (name: string) =>
  readFileSync(join(process.cwd(), '../../supabase/migrations', name), 'utf8');

describe('order payment account DVA hardening migrations', () => {
  it('keeps savings in refreshes and allows the service-role checkout path', () => {
    const savings = migration(
      '20260825200000_include_savings_in_dva_balance_refresh.sql'
    );
    const serviceRole = migration(
      '20260825204500_allow_service_role_dva_balance_refresh.sql'
    );
    expect(savings).toContain('customer_savings_redemptions');
    expect(savings).toContain(') + v_savings_paid');
    expect(serviceRole).toContain(
      "auth.uid() IS NULL AND auth.role() <> 'service_role'"
    );
    expect(serviceRole).toContain('TO authenticated, service_role;');
  });

  it('refreshes reused aliases without exposing the internal overload', () => {
    const hardened = migration(
      '20260825203000_harden_checkout_dva_reservation.sql'
    );
    expect(hardened).toContain("IF v_reservation_result = 'existing'");
    expect(hardened).toContain(
      'PERFORM public.refresh_paystack_order_payable_amount(p_order_id)'
    );
    expect(hardened).toContain(') FROM PUBLIC, anon, authenticated;');
    expect(hardened).toContain(') TO service_role;');
  });

  it('preserves expired history and normalizes email identity comparisons', () => {
    const history = migration(
      '20260825210000_preserve_paystack_alias_history.sql'
    );
    expect(history).not.toContain('DELETE FROM public.order_payment_accounts');
    expect(history).toContain('RETURN NOT EXISTS');
    expect(history).toContain(
      'lower(trim(NEW.customer_email)) IS DISTINCT FROM lower(trim(OLD.customer_email))'
    );
  });

  it('allows history rows while locking raw inserts in reservation order', () => {
    const historyRows = migration(
      '20260825213000_allow_paystack_alias_history_rows.sql'
    );
    expect(historyRows).toContain(
      'DROP CONSTRAINT IF EXISTS unique_order_account'
    );
    expect(historyRows.indexOf("'baci_order_payment:'")).toBeLessThan(
      historyRows.indexOf("'paystack_order_account:'")
    );
    expect(historyRows).toContain('account.order_id = NEW.order_id');
  });

  it('restores cross-order receiver exclusion for raw writers', () => {
    const crossOrder = migration(
      '20260825220000_restore_cross_order_paystack_alias_guard.sql'
    );
    expect(crossOrder).toContain('account.order_id <> NEW.order_id');
    expect(crossOrder).toContain(
      'account.account_number = trim(NEW.account_number)'
    );
  });
});

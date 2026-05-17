import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const migrationPath = (fileName: string) =>
  resolve(currentDir, '../../../../../../../supabase/migrations', fileName);

describe('IMEI lookup migration grants', () => {
  it('never grants authenticated direct IMEI lookup writes during setup migrations', () => {
    for (const fileName of [
      '20260515142000_imei_lookups_table.sql',
      '20260515142400_imei_lookups_authenticated_write_policies.sql',
      '20260515142500_restrict_imei_lookup_authenticated_grants.sql',
    ]) {
      const sql = readFileSync(migrationPath(fileName), 'utf8');

      expect(sql).not.toMatch(
        /GRANT\s+(?:INSERT|UPDATE)\s*(?:\([^)]*\))?\s+ON\s+public\.imei_lookups\s+TO\s+authenticated/i
      );
    }
  });

  it('revokes authenticated IMEI lookup writes in the final grant migration', () => {
    const sql = readFileSync(
      migrationPath(
        '20260516120100_revoke_authenticated_imei_lookup_writes.sql'
      ),
      'utf8'
    );

    expect(sql).toContain(
      'REVOKE INSERT, UPDATE ON public.imei_lookups FROM authenticated;'
    );
    expect(sql).not.toMatch(
      /GRANT\s+INSERT\s*,\s*UPDATE\s+ON\s+public\.imei_lookups\s+TO\s+authenticated/i
    );
    expect(sql).toContain(
      'DROP POLICY IF EXISTS "customer_inserts_own_imei_lookups"'
    );
    expect(sql).toContain(
      'DROP POLICY IF EXISTS "customer_updates_own_imei_lookups"'
    );
    expect(sql).not.toMatch(
      /GRANT\s+(?:INSERT|UPDATE)\s*(?:\([^)]*\))?\s+ON\s+public\.imei_lookups\s+TO\s+authenticated/i
    );
  });

  it('validates IMEI refund amounts against the original debit migration', () => {
    const sql = readFileSync(
      migrationPath('20260516105713_validate_imei_refund_amount.sql'),
      'utf8'
    );

    expect(sql).toContain('v_original_amount numeric;');
    expect(sql).toContain("cwt.source_type = 'imei_wallet_payment'");
    expect(sql).toContain("cwt.type = 'redemption'");
    expect(sql).toContain('p_amount <> v_original_amount');
    expect(sql).toContain('imei_refund_amount_mismatch');
    expect(sql).toContain(
      'VALUES (p_customer_id, p_merchant_id, v_original_amount, 0)'
    );
  });

  // The EFFECTIVE definition is whatever the latest CREATE OR REPLACE
  // migration installs. A stale-base CREATE OR REPLACE can silently revert
  // earlier hardening while the older file still literally contains the
  // guard string (which the test above only pins in the OLD file). Pin the
  // invariants on the latest refund migration so that regression is caught.
  it('preserves refund amount-validation AND no-wallet-mint in the latest refund migration', () => {
    const sql = readFileSync(
      migrationPath(
        '20260516120000_fix_refund_imei_wallet_payment_no_wallet_mint.sql'
      ),
      'utf8'
    );

    // Amount-validation hardening from 20260516105713 must survive.
    expect(sql).toContain('v_original_amount numeric;');
    expect(sql).toContain("cwt.source_type = 'imei_wallet_payment'");
    expect(sql).toContain("cwt.type = 'redemption'");
    expect(sql).toContain('p_amount <> v_original_amount');
    expect(sql).toContain('imei_refund_amount_mismatch');
    // Credit/ledger must use the trusted original amount, never p_amount.
    expect(sql).toContain('available_balance + v_original_amount');
    expect(sql).not.toMatch(/available_balance\s*\+\s*p_amount/);

    // No-wallet-mint fix: must NOT recreate a wallet via upsert; must take a
    // row lock and raise when the wallet is absent.
    expect(sql).not.toMatch(
      /INSERT\s+INTO\s+public\.customer_wallets[\s\S]*ON\s+CONFLICT/i
    );
    expect(sql).toMatch(
      /FROM\s+public\.customer_wallets\s+WHERE\s+customer_id\s*=\s*p_customer_id\s+AND\s+merchant_id\s*=\s*p_merchant_id\s+FOR\s+UPDATE/i
    );
    expect(sql).toContain(
      'refund_imei_wallet_payment: wallet not found for customer'
    );
  });
});

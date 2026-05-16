import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const migrationPath = (fileName: string) =>
  resolve(currentDir, '../../../../../../../supabase/migrations', fileName);

describe('IMEI lookup migration grants', () => {
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
});

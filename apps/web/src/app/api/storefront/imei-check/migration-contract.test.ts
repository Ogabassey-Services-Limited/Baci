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

  it('installs the Petrock write-ahead debit and private provider state contract', () => {
    const sql = [
      '20260710210000_petrock_provider_product_catalog.sql',
      '20260710210100_petrock_imei_async_foundation.sql',
    ]
      .map((fileName) => readFileSync(migrationPath(fileName), 'utf8'))
      .join('\n');

    for (const status of [
      'provider_submitting',
      'pending_provider',
      'submission_unknown',
    ]) {
      expect(sql).toContain(`'${status}'::text`);
    }

    expect(sql).toContain(
      'CREATE TABLE IF NOT EXISTS public.imei_provider_products'
    );
    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION public.sync_petrock_imei_provider_products'
    );
    expect(sql).toMatch(
      /UPDATE public\.imei_provider_products[\s\S]+active = false[\s\S]+INSERT INTO public\.imei_provider_products[\s\S]+ON CONFLICT \(provider, product_id\) DO UPDATE/i
    );
    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION public.redeem_imei_wallet_and_begin_provider_submission'
    );
    expect(sql).toContain("source_type = 'imei_wallet_payment'");
    expect(sql).toContain("'provider_submitting'");
    expect(sql).toContain('feedback_token_hash = p_feedback_token_hash');
    expect(sql).toContain('identifier_ciphertext = p_identifier_ciphertext');
    expect(sql).toContain(
      'REVOKE ALL ON public.imei_lookups FROM PUBLIC, anon, authenticated;'
    );
    expect(sql).toMatch(
      /GRANT\s+SELECT\s*\([^)]+\)\s+ON\s+public\.imei_lookups\s+TO\s+authenticated/is
    );
    expect(sql).not.toMatch(
      /GRANT\s+SELECT\s*\([^)]*(?:feedback_token_hash|identifier_ciphertext|cost_usd|provider_order_id)[^)]*\)\s+ON\s+public\.imei_lookups\s+TO\s+authenticated/is
    );
    expect(sql).toContain(
      'REVOKE ALL ON FUNCTION public.redeem_imei_wallet_and_begin_provider_submission'
    );
    expect(sql).toContain('TO service_role;');
  });

  it('leases reconciliation rows and finalizes Petrock results atomically', () => {
    const sql = readFileSync(
      migrationPath('20260710210200_petrock_imei_reconciliation_rpcs.sql'),
      'utf8'
    );

    expect(sql).toContain('FOR UPDATE SKIP LOCKED');
    expect(sql).toContain('reconcile_lease_until');
    expect(sql).toContain('p_lease_token uuid DEFAULT NULL::uuid');
    expect(sql).toContain('reconcile_lease_token = p_lease_token');
    expect(sql).toContain('reconcile_lease_until >= pg_catalog.now()');
    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION public.finalize_petrock_imei_lookup'
    );
    expect(sql).toContain('PERFORM * FROM public.refund_imei_wallet_payment');
    expect(sql).toContain(
      "v_current_status = ANY (ARRAY['provider_submitting'::text, 'pending_provider'::text, 'submission_unknown'::text])"
    );
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION');
    expect(sql).toContain('TO service_role;');
  });

  it('reserves customer status polls so clients and cron do not double-poll', () => {
    const sql = readFileSync(
      migrationPath('20260710210300_petrock_imei_status_poll_rpcs.sql'),
      'utf8'
    );

    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION public.claim_petrock_imei_lookup_poll'
    );
    expect(sql).toContain('FOR UPDATE SKIP LOCKED');
    expect(sql).toContain('l.customer_id = p_customer_id');
    expect(sql).toContain('l.merchant_id = p_merchant_id');
    expect(sql).toContain('reconcile_lease_token = p_lease_token');
    expect(sql).toContain('TO service_role;');
  });

  it('stores only private metadata for untrusted Petrock feedback capture', () => {
    const sql = readFileSync(
      migrationPath('20260711200000_petrock_feedback_capture.sql'),
      'utf8'
    );

    expect(sql).toContain(
      'CREATE TABLE IF NOT EXISTS public.petrock_feedback_events'
    );
    expect(sql).toContain(
      'ALTER TABLE public.petrock_feedback_events ENABLE ROW LEVEL SECURITY'
    );
    expect(sql).toContain(
      'REVOKE ALL ON public.petrock_feedback_events FROM PUBLIC, anon, authenticated'
    );
    expect(sql).toContain(
      'GRANT SELECT, INSERT ON public.petrock_feedback_events TO service_role'
    );
    expect(sql).not.toMatch(/raw_body|payload\s+jsonb/i);
  });
});

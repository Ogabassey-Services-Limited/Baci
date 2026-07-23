import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migrationsDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../supabase/migrations'
);

function readMigration(fileName: string): string {
  return readFileSync(resolve(migrationsDirectory, fileName), 'utf8');
}

describe('PayPal BYOK migration contracts', () => {
  it('atomically serializes both credential-role replacements', () => {
    const sql = readMigration(
      '20260723000013_replace_merchant_payment_credential_pair.sql'
    );

    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION public.replace_merchant_payment_credential_pair'
    );
    expect(sql).toContain('pg_catalog.pg_advisory_xact_lock');
    const lockOffset = sql.indexOf('pg_catalog.pg_advisory_xact_lock');
    const insertOffset = sql.indexOf(
      'INSERT INTO private.merchant_payment_credentials'
    );
    const clientIdOffset = sql.indexOf("'client_id'", insertOffset);
    const secretKeyOffset = sql.indexOf("'secret_key'", insertOffset);
    const conflictOffset = sql.indexOf(
      'ON CONFLICT (merchant_id, provider, credential_role, environment)',
      insertOffset
    );
    expect(lockOffset).toBeLessThan(insertOffset);
    expect(insertOffset).toBeLessThan(clientIdOffset);
    expect(clientIdOffset).toBeLessThan(secretKeyOffset);
    expect(secretKeyOffset).toBeLessThan(conflictOffset);
    expect(sql).toContain(
      'ON CONFLICT (merchant_id, provider, credential_role, environment)'
    );
    expect(sql).toMatch(
      /key_last4,\s+is_active,\s+last_validated_at,\s+last_validation_error,\s+disabled_at,\s+disabled_reason\s*\)/
    );
    expect(
      sql.match(/\btrue,\s+pg_catalog\.now\(\),\s+NULL,\s+NULL,\s+NULL/g)
    ).toHaveLength(2);
    expect(sql).toMatch(/SECURITY DEFINER\s+SET search_path = ''/);
    const pairSignature = String.raw`public\.replace_merchant_payment_credential_pair\(\s*uuid,\s*text,\s*text,\s*text,\s*smallint,\s*text,\s*text,\s*smallint,\s*text\s*\)`;
    expect(sql).toMatch(
      new RegExp(
        String.raw`GRANT EXECUTE ON FUNCTION\s+${pairSignature}\s+TO service_role`
      )
    );
    for (const role of ['PUBLIC', 'anon', 'authenticated']) {
      expect(sql).toMatch(
        new RegExp(
          String.raw`REVOKE ALL ON FUNCTION\s+${pairSignature}\s+FROM ${role}`
        )
      );
    }
    expect(sql).not.toMatch(
      new RegExp(
        String.raw`GRANT EXECUTE ON FUNCTION\s+${pairSignature}\s+TO (?:anon|authenticated)`
      )
    );
  });

  it('preserves and validates the authoritative settlement foreign key', () => {
    const sql = readMigration(
      '20260723000005_orders_paid_transaction_marker.sql'
    );

    expect(sql).toContain("conrelid = 'public.orders'::regclass");
    expect(sql).toContain("confrelid = 'public.transactions'::regclass");
    expect(sql).toContain("confdeltype = 'a'");
    expect(sql).toContain("a.attname = 'paid_transaction_id'");
    expect(sql).toContain("a.attname = 'id'");
    expect(sql).toContain('FOREIGN KEY (paid_transaction_id)');
    expect(sql).toContain('REFERENCES public.transactions(id)');
    expect(sql).toContain('ON DELETE NO ACTION');
    expect(sql).not.toContain('ON DELETE SET NULL');
    expect(sql).not.toContain('CREATE INDEX');
  });

  it('builds the settlement-marker index concurrently', () => {
    const sql = readMigration(
      '20260723000006_orders_paid_transaction_marker_index.sql'
    );

    expect(sql.startsWith('-- disable-transaction')).toBe(true);
    expect(sql).toContain(
      'DROP INDEX CONCURRENTLY IF EXISTS public.idx_orders_paid_transaction_id_next'
    );
    expect(sql).toMatch(
      /CREATE INDEX CONCURRENTLY idx_orders_paid_transaction_id_next\s+ON public\.orders \(paid_transaction_id\)\s+WHERE paid_transaction_id IS NOT NULL;/
    );
    const createNextOffset = sql.indexOf(
      'CREATE INDEX CONCURRENTLY idx_orders_paid_transaction_id_next'
    );
    const dropLiveOffset = sql.indexOf(
      'DROP INDEX CONCURRENTLY IF EXISTS public.idx_orders_paid_transaction_id;'
    );
    const renameOffset = sql.indexOf(
      'ALTER INDEX public.idx_orders_paid_transaction_id_next'
    );
    expect(createNextOffset).toBeGreaterThan(-1);
    expect(createNextOffset).toBeLessThan(dropLiveOffset);
    expect(dropLiveOffset).toBeLessThan(renameOffset);
    expect(sql).toMatch(
      /ALTER INDEX public\.idx_orders_paid_transaction_id_next\s+RENAME TO idx_orders_paid_transaction_id;/
    );
  });

  it('builds the refund-pending index concurrently', () => {
    const statusSql = readMigration(
      '20260723000010_transactions_refund_statuses.sql'
    );
    const indexSql = readMigration(
      '20260723000011_transactions_refund_pending_index.sql'
    );

    expect(statusSql).not.toContain('CREATE INDEX');
    expect(statusSql).toMatch(
      /ADD CONSTRAINT transactions_status_check[\s\S]*NOT VALID;/
    );
    expect(statusSql).toContain(
      'VALIDATE CONSTRAINT transactions_status_check'
    );
    const statusConstraint = statusSql.match(
      /ADD CONSTRAINT transactions_status_check[\s\S]*?CHECK \(([\s\S]*?)\) NOT VALID;/
    )?.[1];
    expect(
      Array.from(
        statusConstraint?.matchAll(/'([^']+)'::text/g) ?? [],
        (m) => m[1]
      )
    ).toEqual([
      'pending',
      'processing',
      'completed',
      'failed',
      'cancelled',
      'refunded',
      'refund_pending',
    ]);
    expect(indexSql.startsWith('-- disable-transaction')).toBe(true);
    expect(indexSql).toContain(
      'DROP INDEX CONCURRENTLY IF EXISTS public.transactions_refund_pending_idx_next'
    );
    expect(indexSql).toMatch(
      /CREATE INDEX CONCURRENTLY transactions_refund_pending_idx_next\s+ON public\.transactions \(updated_at\)\s+WHERE status = 'refund_pending';/
    );
    const createNextOffset = indexSql.indexOf(
      'CREATE INDEX CONCURRENTLY transactions_refund_pending_idx_next'
    );
    const dropLiveOffset = indexSql.indexOf(
      'DROP INDEX CONCURRENTLY IF EXISTS public.transactions_refund_pending_idx;'
    );
    const renameOffset = indexSql.indexOf(
      'ALTER INDEX public.transactions_refund_pending_idx_next'
    );
    expect(createNextOffset).toBeGreaterThan(-1);
    expect(createNextOffset).toBeLessThan(dropLiveOffset);
    expect(dropLiveOffset).toBeLessThan(renameOffset);
    expect(indexSql).toMatch(
      /ALTER INDEX public\.transactions_refund_pending_idx_next\s+RENAME TO transactions_refund_pending_idx;/
    );
  });

  it('preserves the PayPal capture-persist reconciliation review type', () => {
    const sql = readMigration(
      '20260723000012_include_paypal_capture_persist_review_type.sql'
    );

    expect(sql).toContain(
      'DROP CONSTRAINT IF EXISTS reconciliation_review_issue_type_check'
    );
    const issueTypeConstraint = sql.match(
      /ADD CONSTRAINT reconciliation_review_issue_type_check CHECK \(issue_type IN \(([\s\S]*?)\)\) NOT VALID;/
    )?.[1];
    expect(
      Array.from(issueTypeConstraint?.matchAll(/'([^']+)'/g) ?? [], (m) => m[1])
    ).toEqual([
      'payment_match_ambiguous',
      'payment_match_zero_candidates',
      'manage_stock_cancellation_held',
      'tax_basis_unclassified',
      'tax_basis_inconsistent_total',
      'wallet_dva_order_alias_conflict',
      'customer_savings_auto_debit_allocation_failed',
      'wallet_order_funding_ambiguous',
      'wallet_order_funding_conflict',
      'wallet_order_funding_finalize_failed',
      'payment_received_after_cancellation',
      'payment_received_after_refund',
      'serialized_inventory_confirmation_failed',
      'merchant_settlement_failed',
      'gateway_payment_wedge_requires_review',
      // These two were added by main's Credit Direct + cancellation migrations;
      // since this migration is dated after main's tail it MUST preserve them, or
      // the validated ADD CONSTRAINT rejects existing prod rows and aborts deploy.
      'credit_direct_confirmation_missing',
      'order_cancellation_refund_requires_review',
      'paypal_capture_persist_failed',
    ]);
    expect(sql).toMatch(
      /ADD CONSTRAINT reconciliation_review_issue_type_check[\s\S]*NOT VALID;/
    );
    expect(sql).toContain(
      'VALIDATE CONSTRAINT reconciliation_review_issue_type_check'
    );
  });

  it('removes legacy touch RPCs after atomic replacement owns validation', () => {
    const scopedTouchSql = readMigration(
      '20260723000008_touch_merchant_credential_validated_by_environment.sql'
    );
    const compactTouchSql = scopedTouchSql.replace(/\s+/g, ' ');
    expect(compactTouchSql).toMatch(
      /UPDATE private\.merchant_payment_credentials AS mpc SET last_validated_at = pg_catalog\.now\(\), last_validation_error = NULL, updated_at = pg_catalog\.now\(\) WHERE mpc\.merchant_id = p_merchant_id AND mpc\.provider = p_provider AND mpc\.environment = p_environment;/
    );
    expect(compactTouchSql).toContain(
      "p_provider NOT IN ('paypal', 'stripe', 'flutterwave', 'paystack', 'razorpay')"
    );
    expect(compactTouchSql).toContain("p_environment NOT IN ('test', 'live')");
    expect(compactTouchSql).toContain("USING ERRCODE = '22023'");

    const replacementSql = readMigration(
      '20260723000013_replace_merchant_payment_credential_pair.sql'
    ).replace(/\s+/g, ' ');
    expect(replacementSql).toMatch(
      /last_validated_at, last_validation_error[\s\S]*pg_catalog\.now\(\), NULL[\s\S]*last_validated_at = pg_catalog\.now\(\)/
    );

    const cleanupSql = readMigration(
      '20260723000015_drop_legacy_credential_validation_touch.sql'
    );
    expect(cleanupSql).toContain(
      'DROP FUNCTION IF EXISTS public.touch_merchant_payment_credential_validated(uuid, text);'
    );
    expect(cleanupSql).toContain(
      'DROP FUNCTION IF EXISTS public.touch_merchant_payment_credential_validated(uuid, text, text);'
    );
  });

  it('publishes PayPal flags but minimizes unpublished storefront snapshots', () => {
    const sql = readMigration(
      '20260723000009_public_snapshot_paypal_flags.sql'
    );

    const expectedCustomSettings = `
      pg_catalog.jsonb_strip_nulls(
        pg_catalog.jsonb_build_object(
          'google_merchant_id',
            merchant_row.feature_settings->'custom_settings'->'google_merchant_id',
          'google_store_widget_enabled',
            merchant_row.feature_settings->'custom_settings'->'google_store_widget_enabled',
          'paypal_enabled',
            merchant_row.feature_settings->'custom_settings'->'paypal_enabled',
          'paypal_mode',
            merchant_row.feature_settings->'custom_settings'->'paypal_mode'
        )
      )
    `.replace(/\s+/g, ' ');
    expect(sql.replace(/\s+/g, ' ')).toContain(expectedCustomSettings);
    expect(sql).toMatch(
      /CASE WHEN resolved\.is_published THEN resolved\.feature_settings\s+ELSE NULL::jsonb\s+END AS feature_settings/
    );
    expect(sql).toMatch(
      /CASE\s+WHEN resolved\.is_published THEN pg_catalog\.jsonb_build_object\([\s\S]*?ELSE pg_catalog\.jsonb_build_object\(\s*'id',[\s\S]*?'business_name',[\s\S]*?'slug',[\s\S]*?'is_published', false\s*\)\s*END AS merchant_data/
    );
  });

  it('atomically terminalizes PayPal refund audits with locked metadata merge', () => {
    const sql = readMigration(
      '20260723000016_mark_paypal_transaction_refunded.sql'
    );
    const compactSql = sql.replace(/\s+/g, ' ');

    expect(compactSql).toMatch(
      /SELECT t\.metadata INTO v_metadata FROM public\.transactions AS t WHERE t\.id = p_transaction_id[\s\S]*FOR UPDATE;/
    );
    expect(compactSql).toContain("'paypal_pending_refund_ids'");
    expect(compactSql).toContain(
      'THEN pg_catalog.to_jsonb(p_pending_refund_ids)'
    );
    expect(compactSql).toContain(
      "'paypal_restore_prepaid_on_refund_reconcile'"
    );
    expect(compactSql).toContain(
      'WHEN p_restore_prepaid_on_reconcile THEN true'
    );
    expect(compactSql).toMatch(
      /UPDATE public\.transactions AS t SET status = p_status,[\s\S]*WHERE t\.id = p_transaction_id;/
    );
    expect(compactSql).toContain('RETURN v_updated_rows = 1;');
    expect(compactSql).toContain('IF NOT FOUND THEN RETURN false;');
  });

  it('returns merchant country through the bounded order payment snapshot', () => {
    const sql = readMigration(
      '20260723000017_order_payment_snapshot_merchant_country.sql'
    );
    const compactSql = sql.replace(/\s+/g, ' ');

    expect(compactSql).toContain('merchant_country text');
    expect(compactSql).toContain('m.country AS merchant_country');
    expect(compactSql).toContain(
      'JOIN public.merchants AS m ON m.id = o.merchant_id'
    );
    expect(compactSql).toContain(
      'REVOKE ALL ON FUNCTION public.get_order_payment_snapshot(uuid, text) FROM PUBLIC;'
    );
  });

  it('atomically preserves the first savings-reversal audit transition', () => {
    const sql = readMigration(
      '20260723000014_mark_savings_redemptions_reversed.sql'
    );
    const compactSql = sql.replace(/\s+/g, ' ');

    expect(compactSql).toMatch(
      /UPDATE public\.customer_savings_redemptions AS csr SET metadata = csr\.metadata \|\| pg_catalog\.jsonb_build_object\(\s*'reversed_at', pg_catalog\.clock_timestamp\(\), 'reversed_reason', p_reason \) WHERE csr\.merchant_id = p_merchant_id AND csr\.order_id = p_order_id AND csr\.metadata->>'reversed_at' IS NULL;/
    );
    expect(compactSql).toMatch(
      /IF v_updated_rows = 0 AND NOT EXISTS \( SELECT 1 FROM public\.customer_savings_redemptions AS csr WHERE csr\.merchant_id = p_merchant_id AND csr\.order_id = p_order_id AND csr\.metadata->>'reversed_at' IS NOT NULL \) THEN RAISE EXCEPTION 'savings redemption not found' USING ERRCODE = 'P0002';/
    );
    const signature = String.raw`public\.mark_customer_savings_redemptions_reversed\(uuid, uuid, text\)`;
    for (const role of ['PUBLIC', 'anon', 'authenticated']) {
      expect(sql).toMatch(
        new RegExp(`REVOKE ALL ON FUNCTION ${signature} FROM ${role}`)
      );
    }
    expect(sql).toMatch(
      new RegExp(`GRANT EXECUTE ON FUNCTION ${signature} TO service_role`)
    );
  });
});

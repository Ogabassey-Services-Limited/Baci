import { describe, expect, it } from 'vitest';
import { readByokMigration as readMigration } from './read-byok-migration';

describe('PayPal BYOK migration contracts (review types, snapshots, audits)', () => {
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

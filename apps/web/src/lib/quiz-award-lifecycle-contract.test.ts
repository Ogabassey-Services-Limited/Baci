import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = resolve(
  currentDirectory,
  '../../../../supabase/migrations'
);
const foundationSql = readFileSync(
  resolve(migrationsDirectory, '20260516084349_quiz_phase1a_foundation.sql'),
  'utf8'
);
const rpcSql = readFileSync(
  resolve(migrationsDirectory, '20260516084622_quiz_phase1a_rpcs.sql'),
  'utf8'
);
const voucherOrderRpcSql = readFileSync(
  resolve(migrationsDirectory, '20260522002607_quiz_voucher_order_rpc.sql'),
  'utf8'
);
const voucherOrderFinalizerSql = readFileSync(
  resolve(
    migrationsDirectory,
    '20260709163000_finalize_quiz_voucher_order_payment.sql'
  ),
  'utf8'
);
const eventLifecycleSql = readFileSync(
  resolve(
    migrationsDirectory,
    '20260714220000_quiz_event_lifecycle_followup.sql'
  ),
  'utf8'
);
const regressionSql = readFileSync(
  resolve(migrationsDirectory, 'tests/quiz_phase1a_foundation.sql'),
  'utf8'
);
const quizMigrationFiles = readdirSync(migrationsDirectory)
  .filter((file) => /^20\d{12}_.*quiz.*\.sql$/.test(file))
  .sort()
  .map((file) => ({
    file,
    sql: readFileSync(resolve(migrationsDirectory, file), 'utf8'),
  }));

describe('quiz migration contracts', () => {
  it('keeps quiz voucher payment finalization idempotent without overwriting terminal orders', () => {
    expect(voucherOrderFinalizerSql).toMatch(/o\.payment_status/i);
    expect(voucherOrderFinalizerSql).toMatch(/o\.payment_method/i);
    expect(voucherOrderFinalizerSql).toMatch(/o\.amount_paid/i);
    expect(voucherOrderFinalizerSql).toMatch(
      /payment_status\s*=\s*'paid'[\s\S]*payment_method\s*=\s*'quiz_voucher'[\s\S]*RETURN\s+true/i
    );
    expect(voucherOrderFinalizerSql).toMatch(
      /payment_status\s+NOT\s+IN\s*\(\s*'unpaid'\s*,\s*'pending'\s*\)[\s\S]*quiz_voucher_order_payment_status_invalid/i
    );
  });

  it('keeps quiz time-limit clamping compatible with PostgreSQL conditional expressions', () => {
    const lastClampPatchIndex = quizMigrationFiles.findLastIndex(
      ({ sql }) =>
        /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.start_quiz_attempt/i.test(
          sql
        ) &&
        /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.submit_quiz_answer/i.test(
          sql
        ) &&
        /LEAST\(GREATEST\(/i.test(sql)
    );
    const lastQualifiedClampBeforePatchIndex = quizMigrationFiles.findLastIndex(
      ({ sql }, index) =>
        index < lastClampPatchIndex &&
        /pg_catalog\.least\(pg_catalog\.greatest\(/i.test(sql)
    );
    const patchSql = quizMigrationFiles[lastClampPatchIndex]?.sql ?? '';

    expect(lastQualifiedClampBeforePatchIndex).toBeGreaterThanOrEqual(0);
    expect(lastClampPatchIndex).toBeGreaterThan(
      lastQualifiedClampBeforePatchIndex
    );
    expect(patchSql).toMatch(/public\.start_quiz_attempt/i);
    expect(patchSql).toMatch(/public\.submit_quiz_answer/i);
    expect(patchSql).not.toMatch(/pg_catalog\.(least|greatest)\(/i);
  });

  it('keeps catalog-backed migration regression checks for variant exposure', () => {
    expect(regressionSql).toMatch(/has_column_privilege/i);
    expect(regressionSql).toMatch(
      /pg_get_expr\s*\(\s*polqual\s*,\s*polrelid\s*\)/i
    );
    expect(regressionSql).toMatch(/answer_key_hash/i);
    expect(regressionSql).toMatch(/explanation/i);
    expect(regressionSql).toMatch(/quiz_events_client_read/i);
    expect(regressionSql).toMatch(/quiz_variants_client_read/i);
  });

  it('checks finalize-awards attempt ownership before calling the privileged event finalizer', () => {
    const finalizeAwardsSql = rpcSql.match(
      /CREATE OR REPLACE FUNCTION public\.finalize_quiz_awards[\s\S]*?\$\$;/i
    )?.[0];

    expect(finalizeAwardsSql).toBeDefined();
    expect(finalizeAwardsSql).toMatch(
      /JOIN\s+public\.customers\s+c\s+ON\s+c\.id\s*=\s*a\.customer_id/i
    );
    expect(finalizeAwardsSql).toMatch(/a\.id\s*=\s*p_attempt_id/i);
    expect(finalizeAwardsSql).toMatch(/a\.event_id\s*=\s*p_event_id/i);
    expect(finalizeAwardsSql).toMatch(/a\.status\s*=\s*'submitted'/i);
    expect(finalizeAwardsSql).toMatch(/c\.user_id\s*=\s*p_user_id/i);
    expect(finalizeAwardsSql).toMatch(/quiz_attempt_not_found/i);
    expect(finalizeAwardsSql?.indexOf('JOIN public.customers c')).toBeLessThan(
      finalizeAwardsSql?.indexOf('public.finalize_quiz_event_awards') ?? -1
    );
  });

  it('closes due product-prize events without entering the ranked award path', () => {
    expect(eventLifecycleSql).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.close_due_product_quiz_events\(\)/i
    );
    expect(eventLifecycleSql).toMatch(
      /settings\s*\?\s*'prize_product_id'[\s\S]*status\s+IN\s*\('active',\s*'scheduled'\)[\s\S]*ends_at\s*<=\s*pg_catalog\.now\(\)\s*-\s*interval\s*'2 minutes'/i
    );
    expect(eventLifecycleSql).toMatch(
      /UPDATE\s+public\.quiz_events[\s\S]*SET\s+status\s*=\s*'completed'[\s\S]*WHERE\s+id\s*=\s*v_product_event_id/i
    );
  });

  it('reprocesses only Phase-1a stub finalizations with no awards', () => {
    expect(eventLifecycleSql).toMatch(
      /refresh_reason\s*=\s*'phase1a_award_finalize_stub'[\s\S]*NOT\s+EXISTS\s*\([\s\S]*FROM\s+public\.quiz_awards/i
    );
    expect(eventLifecycleSql).not.toMatch(
      /award_finalized_at\s*(?:<|<=|>|>=)\s*'[^']+'/i
    );
    expect(eventLifecycleSql).toMatch(
      /refresh_reason\s*=\s*'cron_award_finalize_rank_winners'/i
    );
    expect(eventLifecycleSql).toMatch(
      /SET\s+award_finalized_at\s*=\s*pg_catalog\.now\(\)[\s\S]*PERFORM\s+public\.mint_quiz_event_ranked_awards\(v_ranked_event_id\)/i
    );
    expect(eventLifecycleSql).not.toMatch(
      /v_count\s+integer\s*:=\s*public\.close_due_product_quiz_events\(\)/i
    );
  });

  it('makes event award finalization idempotent before queueing work', () => {
    const eventFinalizerSql = rpcSql.match(
      /CREATE OR REPLACE FUNCTION public\.finalize_quiz_event_awards[\s\S]*?\$\$;/i
    )?.[0];

    expect(eventFinalizerSql).toBeDefined();
    expect(eventFinalizerSql).toMatch(
      /UPDATE\s+public\.quiz_events[\s\S]*award_finalized_at\s*=\s*pg_catalog\.now\(\)[\s\S]*WHERE\s+id\s*=\s*p_event_id[\s\S]*award_finalized_at\s+IS\s+NULL/is
    );
    expect(eventFinalizerSql).toMatch(/IF\s+NOT\s+FOUND\s+THEN\s+RETURN\s+0/is);
    expect(
      eventFinalizerSql?.indexOf('UPDATE public.quiz_events')
    ).toBeLessThan(
      eventFinalizerSql?.indexOf(
        'INSERT INTO public.leaderboard_refresh_log'
      ) ?? -1
    );
  });

  it('scopes prize claim customer lookups through the award event merchant', () => {
    const grandClaimSql = rpcSql.match(
      /CREATE OR REPLACE FUNCTION public\.claim_quiz_grand_prize[\s\S]*?\$\$;/i
    )?.[0];
    const cashClaimSql = rpcSql.match(
      /CREATE OR REPLACE FUNCTION public\.claim_quiz_cash_award[\s\S]*?\$\$;/i
    )?.[0];

    expect(grandClaimSql).toBeDefined();
    expect(cashClaimSql).toBeDefined();
    expect(grandClaimSql).toMatch(
      /JOIN\s+public\.quiz_events\s+e\s+ON\s+e\.id\s*=\s*p_event_id\s+AND\s+e\.merchant_id\s*=\s*c\.merchant_id/i
    );
    expect(grandClaimSql).toMatch(/c\.user_id\s*=\s*p_user_id/i);
    expect(cashClaimSql).toMatch(/FROM\s+public\.quiz_awards\s+qa/i);
    expect(cashClaimSql).toMatch(
      /JOIN\s+public\.quiz_events\s+e\s+ON\s+e\.id\s*=\s*qa\.event_id/i
    );
    expect(cashClaimSql).toMatch(
      /JOIN\s+public\.customers\s+c\s+ON\s+c\.merchant_id\s*=\s*e\.merchant_id/i
    );
    expect(cashClaimSql).toMatch(/qa\.id\s*=\s*p_award_id/i);
    expect(cashClaimSql).toMatch(/c\.user_id\s*=\s*p_user_id/i);
  });

  it('adds a proof-gated voucher order RPC without exposing it to anon callers', () => {
    expect(voucherOrderRpcSql).toMatch(
      /ALTER\s+TABLE\s+public\.order_items[\s\S]*ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+quiz_award_id\s+uuid/i
    );
    expect(voucherOrderRpcSql).toMatch(
      /CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_order_items_quiz_award_id_unique/i
    );
    expect(voucherOrderRpcSql).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.create_storefront_order_with_quiz_voucher/i
    );
    expect(voucherOrderRpcSql).toMatch(/SECURITY\s+DEFINER/i);
    expect(voucherOrderRpcSql).toMatch(/SET\s+search_path\s*=\s*''/i);
    expect(voucherOrderRpcSql).toMatch(
      /public\.quiz_route_proof_valid\s*\(\s*p_route_proof\s*,\s*'create_storefront_order_with_quiz_voucher'\s*,\s*v_award_id::text\s*,\s*p_user_id\s*\)/is
    );
    expect(voucherOrderRpcSql).toMatch(
      /jsonb_array_elements\s*\(\s*p_items\s*\)/i
    );
    expect(voucherOrderRpcSql).toMatch(/v_voucher_item_count\s*<>\s*1/i);
    expect(voucherOrderRpcSql).toMatch(/FOR\s+UPDATE\s+OF\s+qa/i);
    expect(voucherOrderRpcSql).toMatch(/qa\.status\s*<>\s*'approved'/i);
    expect(voucherOrderRpcSql).toMatch(/qa\.award_type\s*<>\s*'store_credit'/i);
    expect(voucherOrderRpcSql).toMatch(/public\.create_storefront_order\s*\(/i);
    expect(voucherOrderRpcSql).toMatch(
      /p_discount_amount\s*=>\s*COALESCE\s*\(\s*p_discount_amount\s*,\s*0\s*\)\s*\+\s*COALESCE\s*\(\s*v_award_amount\s*,\s*0\s*\)/i
    );
    expect(voucherOrderRpcSql).toMatch(
      /UPDATE\s+public\.order_items[\s\S]*SET\s+quiz_award_id\s*=\s*v_award_id/is
    );
    expect(voucherOrderRpcSql).toMatch(
      /UPDATE\s+public\.quiz_awards[\s\S]*SET\s+status\s*=\s*'claimed'/is
    );
    expect(voucherOrderRpcSql).toMatch(
      /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.create_storefront_order_with_quiz_voucher[\s\S]*FROM\s+PUBLIC,\s+anon,\s+authenticated/i
    );
    expect(voucherOrderRpcSql).not.toMatch(
      /GRANT\s+(?:ALL|EXECUTE)[\s\S]*create_storefront_order_with_quiz_voucher[\s\S]*TO\s+anon/i
    );
    expect(voucherOrderRpcSql).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.create_storefront_order_with_quiz_voucher[\s\S]*TO\s+authenticated,\s+service_role/i
    );
  });

  it('records non-sensitive proof validation failures without granting client access', () => {
    expect(foundationSql).toMatch(
      /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.quiz_proof_validation_failures/is
    );
    expect(foundationSql).toMatch(
      /ALTER\s+TABLE\s+public\.quiz_proof_validation_failures\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i
    );
    expect(foundationSql).toMatch(
      /REVOKE\s+ALL\s+ON\s+TABLE[\s\S]*public\.quiz_proof_validation_failures[\s\S]*FROM\s+anon,\s+authenticated/i
    );
    expect(foundationSql).toMatch(/subject_id\s+text/i);
    expect(foundationSql).toMatch(/action\s+text/i);
    expect(foundationSql).toMatch(/created_at\s+timestamptz\s+NOT\s+NULL/i);
    expect(rpcSql).toMatch(/quiz_log_route_proof_failure/is);
    expect(rpcSql).toMatch(/v_proof->>'subject_id'/i);
    expect(rpcSql).toMatch(/v_proof->>'action'/i);
    expect(rpcSql).toMatch(/'signature_mismatch'/i);
    expect(rpcSql).not.toMatch(/signature\s*,\s*reason/i);
  });

  it('creates production approval evidence columns and tracker table', () => {
    expect(foundationSql).toMatch(/nlrc_permit_ref\s+text/i);
    expect(foundationSql).toMatch(/published_odds\s+jsonb/i);
    expect(foundationSql).toMatch(/compliance_flags\s+jsonb/i);
    expect(foundationSql).toMatch(
      /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.quiz_compliance_tracker/is
    );
    expect(foundationSql).toMatch(
      /ALTER\s+TABLE\s+public\.quiz_compliance_tracker\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i
    );
  });

  it('keeps quiz awards customer ownership non-null and non-orphaning', () => {
    expect(foundationSql).toMatch(
      /customer_id\s+uuid\s+NOT\s+NULL\s+REFERENCES\s+public\.customers\(id\)\s+ON\s+DELETE\s+RESTRICT/i
    );
    expect(foundationSql).toMatch(/chk_quiz_awards_attempt_required/i);
    expect(foundationSql).toMatch(
      /award_type\s+IN\s+\('cash',\s*'store_credit'\)\s+AND\s+attempt_id\s+IS\s+NOT\s+NULL/i
    );
    expect(foundationSql).toMatch(
      /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_quiz_awards_customer\s+ON\s+public\.quiz_awards\(customer_id\);/i
    );
    expect(foundationSql).toMatch(
      /CREATE\s+POLICY\s+quiz_awards_customer_read[\s\S]*c\.id\s*=\s*customer_id[\s\S]*c\.user_id\s*=\s*\(SELECT\s+auth\.uid\(\)\)/i
    );
  });
});

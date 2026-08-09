import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const migration = (name) =>
  readFile(resolve('supabase/migrations', name), 'utf8');

test('merchant directory repair qualifies output-column sort expressions', async () => {
  const sql = await migration(
    '20260809154414_repair_admin_analytics_read_models.sql'
  );

  assert.match(sql, /THEN filtered\.total_gmv END DESC/);
  assert.match(sql, /THEN filtered\.total_orders END DESC/);
  assert.match(sql, /THEN filtered\.joined_at END DESC/);
  assert.match(sql, /filtered\.merchant_id ASC/);
});

test('Merchant 360 readiness does not require custom-domain verification', async () => {
  const sql = await migration(
    '20260809154415_repair_admin_merchant_360_readiness.sql'
  );

  assert.match(sql, /\{readiness,storefrontReady\}/);
  assert.match(sql, /hasStorefrontSlug/);
  assert.match(sql, /paymentConfigured/);
  assert.match(sql, /shippingConfigured/);
  assert.doesNotMatch(sql, /primary_domain\.verified_at/);
  assert.doesNotMatch(sql, /primary_domain\.ssl_status/);
});

test('reconciliation repair retains currency-less settlement activity without money labels', async () => {
  const sql = await migration(
    '20260809154416_repair_admin_reconciliation_currencyless_activity.sql'
  );

  assert.match(sql, /NULL::numeric AS amount/);
  assert.match(sql, /NULL::text AS currency/);
  assert.match(sql, /FROM settlement_rows sr\n {4}WHERE sr\.status IN/);
  assert.doesNotMatch(sql, /sr\.currency = p_currency/);
  assert.match(sql, /'pendingAmount', NULL, 'pendingCount', sm\.pending_count/);
  assert.match(
    sql,
    /'directSettlements', jsonb_build_object\('amount', NULL, 'count', dm\.count\)/
  );
});

test('system health only considers recent failed email attempts', async () => {
  const sql = await migration(
    '20260809154417_repair_admin_system_health_email_freshness.sql'
  );

  assert.match(sql, /email_attempt\.created_at >= v_now - interval '24 hours'/);
  assert.match(
    sql,
    /email_attempt\.status = 'pending'\n {8}AND email_attempt\.updated_at < v_now - interval '15 minutes'/
  );
  assert.match(
    sql,
    /ALTER FUNCTION public\.get_admin_system_health_v1\(\) RENAME TO get_admin_system_health_v0/
  );
  assert.match(sql, /'emailFailureWindow', '24 hours'/);
  assert.match(
    sql,
    /REVOKE ALL ON FUNCTION public\.get_admin_system_health_v0\(\)/
  );
});

test('operations repair includes stale pending emails in its incident projection', async () => {
  const sql = await migration(
    '20260809154917_repair_admin_operations_stale_email_attempts.sql'
  );

  assert.match(sql, /attempt\.status = 'pending'/);
  assert.match(sql, /attempt\.updated_at < v_now - interval '15 minutes'/);
  assert.match(sql, /\{summary,notifications\}/);
  assert.match(sql, /\{notifications,email\}/);
  assert.match(
    sql,
    /attempt\.status = 'failed'\n {6}OR \(attempt\.status = 'pending'/
  );
  assert.match(
    sql,
    /'status', CASE WHEN email_attempt\.status = 'failed' THEN 'failed' ELSE 'stale' END/
  );
  assert.doesNotMatch(sql, /\|\| v_stale_pending_items/);
  assert.match(sql, /FUNCTION public\.get_admin_operations_v0/);
});

test('isolated replay exercises the production operations v2 projection', async () => {
  const sql = await readFile(
    resolve('supabase/tests/admin_analytics_read_model_repairs.sql'),
    'utf8'
  );

  assert.match(
    sql,
    /\\ir \.\.\/migrations\/20260805151570_harden_admin_error_code_projections\.sql/
  );
  assert.match(
    sql,
    /public\.get_admin_operations_v2\('notifications', 25, 0\)/
  );
  assert.match(sql, /\{notifications,email,0,status\}' <> 'stale'/);
  assert.match(
    sql,
    /fresh pending email incorrectly appears in operations incidents/
  );
});

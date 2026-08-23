import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.resolve(
  process.cwd(),
  '../../supabase/migrations/20260821171051_google_ads_connections_and_spend.sql'
);
const secretRpcMigrationPath = path.resolve(
  process.cwd(),
  '../../supabase/migrations/20260821174945_google_ads_secret_rpcs.sql'
);
const reauthClearAccountMigrationPath = path.resolve(
  process.cwd(),
  '../../supabase/migrations/20260823210000_google_ads_reauth_clear_account.sql'
);

describe('Google Ads migration contract', () => {
  it('creates tenant-scoped tables with encrypted token columns and RLS', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

    expect(sql).toContain(
      'create table if not exists public.merchant_ad_connections'
    );
    expect(sql).toContain('access_token_ciphertext text');
    expect(sql).toContain('refresh_token_ciphertext text');
    expect(sql).toContain(
      'alter table public.merchant_ad_connections enable row level security'
    );
    expect(sql).toContain('public.has_merchant_access(merchant_id)');
    expect(sql).toContain(
      'revoke all on table public.merchant_ad_connections from anon'
    );
    expect(sql).toContain('grant select, insert, update, delete');
  });

  it('enforces the daily provider/customer/date uniqueness boundary', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

    expect(sql).toContain(
      'create table if not exists public.merchant_ad_spend_daily'
    );
    expect(sql).toContain(
      'unique (merchant_id, provider, provider_customer_id, spend_date)'
    );
    expect(sql).toContain('spend_micros bigint not null default 0');
    expect(sql).toContain(
      'alter table public.merchant_ad_spend_daily enable row level security'
    );
  });

  it('keeps encrypted grants behind permission-checked RPCs', () => {
    const sql = readFileSync(secretRpcMigrationPath, 'utf8').toLowerCase();

    expect(sql).toContain('security definer');
    expect(sql).toContain('get_google_ads_connection_secret');
    expect(sql).toContain("'integrations', 'manage'");
    expect(sql).toContain(
      'revoke all on table public.merchant_ad_connections from authenticated'
    );
    expect(sql).toContain('grant select (');
    expect(sql).toContain(
      'revoke all on table public.merchant_ad_spend_daily from authenticated'
    );
    expect(sql).toContain('merchant_ad_connections_select');
    expect(sql).toContain("'analytics', 'view'");
    expect(sql).toContain('upsert_google_ads_spend_daily');
    expect(sql).toContain(
      'revoke all on function public.upsert_google_ads_spend_daily'
    );
  });

  it('clears stale account selection when a Google grant needs reauthorization', () => {
    const sql = readFileSync(
      reauthClearAccountMigrationPath,
      'utf8'
    ).toLowerCase();

    expect(sql).toContain(
      'create or replace function public.mark_google_ads_connection_reauth_if_current'
    );
    expect(sql).toContain('provider_customer_id = null');
    expect(sql).toContain('last_synced_at = null');
    expect(sql).toContain(
      'access_token_ciphertext is not distinct from p_access_token_ciphertext'
    );
    expect(sql).toContain(
      'refresh_token_ciphertext is not distinct from p_refresh_token_ciphertext'
    );
  });
});

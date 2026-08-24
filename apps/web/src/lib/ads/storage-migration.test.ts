import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.resolve(
  process.cwd(),
  '../../supabase/migrations/20260821180000_provider_neutral_ads_storage.sql'
);
const hardeningMigrationPath = path.resolve(
  process.cwd(),
  '../../supabase/migrations/20260821180001_harden_provider_neutral_ads_rpcs.sql'
);
const spendWindowMigrationPath = path.resolve(
  process.cwd(),
  '../../supabase/migrations/20260824090000_replace_social_ads_spend_window.sql'
);

describe('provider-neutral ads storage migration', () => {
  it('extends the Google-only checks without replacing the Google migrations', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

    expect(sql).toContain(
      'drop constraint if exists merchant_ad_connections_provider_check'
    );
    expect(sql).toContain(
      "'google_ads', 'meta_ads', 'tiktok_ads', 'snapchat_ads'"
    );
    expect(sql).toContain('spend_amount_decimal numeric(30, 9)');
    expect(sql).toContain('account_timezone text');
    expect(sql).toContain('attribution_metadata jsonb');
  });

  it('keeps ciphertext denied to normal selects and RPCs permission bounded', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

    expect(sql).toContain('get_merchant_ads_connection_secret');
    expect(sql).toContain('security definer');
    expect(sql).toContain("'integrations', 'manage'");
    expect(sql).toContain(
      'revoke all on table public.merchant_ad_connections from authenticated'
    );
    expect(sql).toContain('grant select (');
    expect(sql).not.toContain(
      'access_token_ciphertext,\n  refresh_token_ciphertext'
    );
    expect(sql).toContain('upsert_merchant_ads_spend_daily');
  });

  it('reserves Google v1 storage for its legacy RPCs and locks new RPC paths', () => {
    const sql = readFileSync(hardeningMigrationPath, 'utf8').toLowerCase();

    expect(sql).toContain(
      "p_provider not in ('meta_ads', 'tiktok_ads', 'snapchat_ads')"
    );
    expect(sql).toContain("set search_path = ''");
    expect(sql).not.toContain('set search_path = public, pg_temp');
    expect(sql).toContain('pg_catalog.jsonb_typeof');
    expect(sql).toContain('pg_catalog.btrim');
  });

  it('atomically replaces a social provider window before applying fresh rows', () => {
    const sql = readFileSync(spendWindowMigrationPath, 'utf8').toLowerCase();

    expect(sql).toContain(
      'create or replace function public.replace_merchant_ads_spend_daily_window'
    );
    expect(sql).toContain('delete from public.merchant_ad_spend_daily');
    expect(sql).toContain('spend_date between p_start_date and p_end_date');
    expect(sql).toContain('public.upsert_merchant_ads_spend_daily');
    expect(sql).toContain('grant execute on function');
    expect(sql).toContain("'meta_ads', 'tiktok_ads', 'snapchat_ads'");
  });
});

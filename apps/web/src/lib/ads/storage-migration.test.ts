import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.resolve(
  process.cwd(),
  '../../supabase/migrations/20260821180000_provider_neutral_ads_storage.sql'
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
});

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = path.resolve(
  process.cwd(),
  '../../supabase/migrations/20260821180006_provider_neutral_ads_oauth_state_nonces.sql'
);

describe('provider-neutral Ads OAuth nonce migration', () => {
  it('binds one-time Google, Meta, and TikTok nonces to the caller and callback', () => {
    const sql = readFileSync(migration, 'utf8').toLowerCase();

    expect(sql).toContain("'google_ads', 'meta_ads', 'tiktok_ads'");
    expect(sql).toContain('reserve_merchant_ads_oauth_state_nonce');
    expect(sql).toContain('consume_merchant_ads_oauth_state_nonce');
    expect(sql).toContain('auth.uid() is distinct from p_user_id');
    expect(sql).toContain("'integrations', 'manage'");
    expect(sql).toContain('redirect_uri = p_redirect_uri');
    expect(sql).toContain('expires_at > pg_catalog.now()');
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain('revoke all on function');
    expect(sql).toContain('grant execute');
  });
});

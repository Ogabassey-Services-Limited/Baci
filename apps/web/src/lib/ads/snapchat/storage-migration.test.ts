import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = path.resolve(
  process.cwd(),
  '../../supabase/migrations/20260821180004_snapchat_ads_oauth_and_disconnect.sql'
);

describe('Snapchat Ads security migration', () => {
  it('atomically consumes OAuth nonces and deletes spend before its connection', () => {
    const sql = readFileSync(migration, 'utf8').toLowerCase();
    expect(sql).toContain(
      'create table if not exists public.merchant_ads_oauth_state_nonces'
    );
    expect(sql).toContain('delete from public.merchant_ads_oauth_state_nonces');
    expect(sql).toContain('delete from public.merchant_ad_spend_daily');
    expect(sql).toContain('delete from public.merchant_ad_connections');
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain('enable row level security');
  });
});

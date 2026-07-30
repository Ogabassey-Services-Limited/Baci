import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  '../../supabase/migrations/20260730132000_add_scoped_merchant_analytics_config.sql'
);

describe('get_merchant_analytics_config migration', () => {
  it('authorizes the supplied merchant before returning owner-only credentials', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain(
      'FUNCTION public.get_merchant_analytics_config(\n  p_merchant_id uuid\n)'
    );
    expect(sql).toContain('public.has_merchant_access(p_merchant_id)');
    expect(sql).toContain('m.user_id = v_user_id');
    expect(sql).toContain('CASE WHEN v_is_owner THEN m.ga4_api_secret END');
    expect(sql).toContain(
      'REVOKE ALL ON FUNCTION public.get_merchant_analytics_config(uuid)'
    );
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION public.get_merchant_analytics_config(uuid)'
    );
  });
});

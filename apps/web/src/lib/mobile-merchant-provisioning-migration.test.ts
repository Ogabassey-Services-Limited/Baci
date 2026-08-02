import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  join(
    process.cwd(),
    '../../supabase/migrations/20260728091958_provision_mobile_merchant_v2.sql'
  ),
  'utf8'
);

describe('provision_mobile_merchant_v2 migration', () => {
  it('defines an authenticated-only invoker RPC with caller-owned identity', () => {
    expect(migrationSql).toContain(
      'CREATE OR REPLACE FUNCTION public.provision_mobile_merchant_v2('
    );
    expect(migrationSql).toContain('SECURITY INVOKER');
    expect(migrationSql).toContain("SET search_path = ''");
    expect(migrationSql).toMatch(/v_user_id\s+uuid\s*:=\s*auth\.uid\(\)/);
    expect(migrationSql).toContain(
      'REVOKE ALL ON FUNCTION public.provision_mobile_merchant_v2'
    );
    const provisioningGrant = migrationSql.match(
      /GRANT EXECUTE ON FUNCTION public\.provision_mobile_merchant_v2\([\s\S]*?\)\s+TO [^;]+;/
    );
    expect(provisioningGrant?.[0]).toContain('TO authenticated');
    expect(provisioningGrant?.[0]).not.toMatch(/\banon\b/);
    expect(provisioningGrant?.[0]).not.toMatch(/\bservice_role\b/);
  });

  it('enforces the exact cross-layer profile and store bounds', () => {
    expect(migrationSql).toContain(
      'char_length(v_first_name) BETWEEN 1 AND 100'
    );
    expect(migrationSql).toContain(
      'char_length(v_last_name) BETWEEN 1 AND 100'
    );
    expect(migrationSql).toContain(
      'char_length(v_business_name) BETWEEN 2 AND 200'
    );
    expect(migrationSql).toContain(
      'char_length(v_business_type) BETWEEN 1 AND 100'
    );
    expect(migrationSql).toContain(
      'char_length(v_other_business_type) BETWEEN 2 AND 100'
    );
    expect(migrationSql).toContain('char_length(v_phone) > 32');
    expect(migrationSql).toContain(
      'char_length(v_requested_slug) BETWEEN 3 AND 63'
    );
    expect(migrationSql).toContain('char_length(v_logo_url) > 2048');
    expect(migrationSql).toContain('char_length(v_primary_color) > 64');
    expect(migrationSql).toContain('char_length(v_background_color) > 64');
    expect(migrationSql).toContain('char_length(v_accent_color) > 64');
    expect(migrationSql).toContain("USING ERRCODE = 'PT400'");
  });

  it('derives country currency and pins the platform domain', () => {
    expect(migrationSql).toContain('-- merchant-country-currency-map:start');
    expect(migrationSql).toContain('-- merchant-country-currency-map:end');
    expect(migrationSql).toContain(
      "v_root_domain CONSTANT text := 'usebaci.com'"
    );
    expect(migrationSql).not.toMatch(/\bp_payout_currency\b/i);
  });

  it('uses bounded slug retries and distinguishes public conflict errors', () => {
    expect(migrationSql).toContain(
      'v_max_slug_attempts CONSTANT integer := 20'
    );
    expect(migrationSql).toMatch(
      /WHILE v_slug_attempt < v_max_slug_attempts LOOP/
    );
    expect(migrationSql).toContain("USING ERRCODE = 'PT409'");
    expect(migrationSql).toContain('GET STACKED DIAGNOSTICS');
    expect(migrationSql).toContain('CONSTRAINT_NAME');
    expect(migrationSql).toContain('MESSAGE_TEXT');

    for (const arbiter of [
      'merchants_user_id_key',
      'merchants_email_key',
      'idx_merchants_slug',
      'domains_active_normalized_domain_uidx',
      'domains_one_primary_per_merchant_idx',
      'staff_members_merchant_id_email_key',
      'staff_members_user_id_merchant_id_key',
      'slug_too_long',
      'slug_is_reserved',
      'slug_is_retired_alias',
    ]) {
      expect(migrationSql).toContain(arbiter);
    }
  });

  it('writes the merchant, preserves a custom primary, and reconciles owner staff', () => {
    expect(migrationSql).toMatch(/INSERT INTO public\.merchants/i);
    expect(migrationSql).toMatch(/UPDATE public\.merchants/i);
    expect(migrationSql).toMatch(/INSERT INTO public\.domains/i);
    expect(migrationSql).toContain('is_primary');
    expect(migrationSql).toMatch(/INSERT INTO public\.staff_members/i);
    expect(migrationSql).toMatch(/UPDATE public\.staff_members/i);
    expect(migrationSql).toContain("role = 'admin'::public.staff_role");
    expect(migrationSql).toContain("status = 'active'");
    expect(migrationSql).toContain('invitation_token = NULL');
    expect(migrationSql).toContain('accepted_at');
    expect(migrationSql).toMatch(
      /EXISTS\s*\([\s\S]*public\.domains[\s\S]*is_primary IS TRUE/i
    );
  });

  it('restricts signup source to mobile telemetry values only', () => {
    expect(migrationSql).toContain("p_signup_source NOT IN ('ios', 'android')");
    expect(migrationSql).toContain("USING ERRCODE = 'PT400'");
  });
});

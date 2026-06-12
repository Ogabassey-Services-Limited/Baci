import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationsDirectory = resolve(
  __dirname,
  '../../../../supabase/migrations'
);

function readMigrationBySuffix(suffix: string): string {
  const fileName = readdirSync(migrationsDirectory).find((candidate) =>
    candidate.endsWith(suffix)
  );

  if (!fileName) {
    throw new Error(`Migration not found: ${suffix}`);
  }

  return readFileSync(resolve(migrationsDirectory, fileName), 'utf8');
}

const publicHelperRpcMigrationSql = readMigrationBySuffix(
  '_harden_public_helper_rpc_grants.sql'
);
const normalizedPublicHelperRpcMigrationSql =
  publicHelperRpcMigrationSql.replace(/\s+/g, ' ');

const accessHelperPolicyMigrationSql = readMigrationBySuffix(
  '_harden_access_helper_policies.sql'
);
const normalizedAccessHelperPolicyMigrationSql =
  accessHelperPolicyMigrationSql.replace(/\s+/g, ' ');

const userContextRpcMigrationSql = readMigrationBySuffix(
  '_harden_user_context_rpc_grants.sql'
);
const normalizedUserContextRpcMigrationSql = userContextRpcMigrationSql.replace(
  /\s+/g,
  ' '
);

describe('Supabase advisor helper RPC migrations', () => {
  it('guards admin banner reads without touching public storefront RPCs', () => {
    expect(publicHelperRpcMigrationSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.get_active_banners[\s\S]*SECURITY DEFINER[\s\S]*SET search_path = ''[\s\S]*public\.has_merchant_access\(p_merchant_id\)/i
    );
    expect(normalizedPublicHelperRpcMigrationSql).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\.get_active_banners\([\s\S]*?\) FROM PUBLIC, anon/i
    );
    expect(normalizedPublicHelperRpcMigrationSql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.get_active_banners\([\s\S]*?\) TO authenticated, service_role/i
    );
  });

  it('removes anonymous access from non-storefront helper mutations', () => {
    expect(normalizedPublicHelperRpcMigrationSql).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\.increment_hero_image_usage\([\s\S]*?\) FROM PUBLIC, anon/i
    );
    expect(normalizedPublicHelperRpcMigrationSql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.increment_hero_image_usage\([\s\S]*?\) TO authenticated, service_role/i
    );
    expect(normalizedPublicHelperRpcMigrationSql).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\.upsert_customer_saved_address_from_order\([\s\S]*?\) FROM PUBLIC, anon, authenticated/i
    );
    expect(normalizedPublicHelperRpcMigrationSql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.upsert_customer_saved_address_from_order\([\s\S]*?\) TO service_role/i
    );
  });

  it('guards caller-supplied access helper lookups', () => {
    expect(accessHelperPolicyMigrationSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.check_staff_permission[\s\S]*SECURITY DEFINER[\s\S]*SET search_path = ''[\s\S]*auth\.uid\(\)[\s\S]*IS DISTINCT FROM p_user_id[\s\S]*RETURN false/i
    );
    expect(accessHelperPolicyMigrationSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.get_user_merchant_access[\s\S]*SECURITY DEFINER[\s\S]*SET search_path = ''[\s\S]*auth\.uid\(\)[\s\S]*IS DISTINCT FROM p_user_id[\s\S]*RETURN/i
    );
    expect(normalizedAccessHelperPolicyMigrationSql).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\.get_user_merchant_access\([\s\S]*?\) FROM PUBLIC, anon, authenticated/i
    );
    expect(normalizedAccessHelperPolicyMigrationSql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.get_user_merchant_access\([\s\S]*?\) TO service_role/i
    );
  });

  it('splits page config public reads from authenticated builder access', () => {
    expect(normalizedAccessHelperPolicyMigrationSql).toContain(
      'DROP POLICY IF EXISTS "Select page configs" ON public.page_configs'
    );
    expect(normalizedAccessHelperPolicyMigrationSql).toMatch(
      /CREATE POLICY "Public can select published page configs" ON public\.page_configs FOR SELECT TO anon USING \(is_published = true\)/i
    );
    expect(normalizedAccessHelperPolicyMigrationSql).toMatch(
      /CREATE POLICY "Authenticated can select page configs"[\s\S]*FOR SELECT TO authenticated[\s\S]*is_published = true[\s\S]*public\.has_merchant_access\(merchant_id\)[\s\S]*public\.check_staff_permission/i
    );
    expect(normalizedAccessHelperPolicyMigrationSql).toMatch(
      /CREATE POLICY "Authenticated can insert page configs"[\s\S]*FOR INSERT TO authenticated/i
    );
    expect(normalizedAccessHelperPolicyMigrationSql).toMatch(
      /CREATE POLICY "Authenticated can update page configs"[\s\S]*FOR UPDATE TO authenticated/i
    );
    expect(normalizedAccessHelperPolicyMigrationSql).toMatch(
      /CREATE POLICY "Authenticated can delete page configs"[\s\S]*FOR DELETE TO authenticated/i
    );
  });

  it('pins user context RPCs to the current signed-in caller', () => {
    expect(userContextRpcMigrationSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.get_user_access\(\)[\s\S]*SECURITY DEFINER[\s\S]*SET search_path = ''[\s\S]*auth\.uid\(\)[\s\S]*auth\.role\(\)[\s\S]*public\.merchants[\s\S]*public\.staff_members/i
    );
    expect(userContextRpcMigrationSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.get_user_merchant_context\(\)[\s\S]*SECURITY DEFINER[\s\S]*SET search_path = ''[\s\S]*auth\.uid\(\)[\s\S]*auth\.role\(\)[\s\S]*public\.merchants[\s\S]*public\.staff_members/i
    );
  });

  it('removes anonymous execution from user context RPCs', () => {
    const userContextFunctions = [
      'get_user_access',
      'get_user_merchant_context',
    ];

    for (const functionName of userContextFunctions) {
      expect(normalizedUserContextRpcMigrationSql).toMatch(
        new RegExp(
          `REVOKE EXECUTE ON FUNCTION public\\.${functionName}\\(\\) FROM PUBLIC, anon`,
          'i'
        )
      );
      expect(normalizedUserContextRpcMigrationSql).toMatch(
        new RegExp(
          `GRANT EXECUTE ON FUNCTION public\\.${functionName}\\(\\) TO authenticated, service_role`,
          'i'
        )
      );
    }
  });
});

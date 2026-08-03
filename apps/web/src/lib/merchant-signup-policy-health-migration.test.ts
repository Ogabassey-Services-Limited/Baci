import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  join(
    process.cwd(),
    '../../supabase/migrations/20260726110000_add_merchant_signup_policy_health_rpc.sql'
  ),
  'utf8'
);
const provisioningMigrationSql = readFileSync(
  join(
    process.cwd(),
    '../../supabase/migrations/20260728091958_provision_mobile_merchant_v2.sql'
  ),
  'utf8'
);

const POLICY_OWNERSHIP_PATTERNS = {
  select_policy_is_expected:
    'user_id[[:space:]]*=[[:space:]]*[(]?[[:space:]]*SELECT[[:space:]]+auth[.]uid[(][)]',
  insert_policy_allows_owner:
    'user_id[[:space:]]*=[[:space:]]*[(]?[[:space:]]*SELECT[[:space:]]+([(][[:space:]]*SELECT[[:space:]]+)?auth[.]uid[(][)]',
} as const;

const POLICY_OWNERSHIP_REGEXES = {
  select_policy_is_expected: /user_id\s*=\s*\(?\s*SELECT\s+auth\.uid\(\)/i,
  insert_policy_allows_owner:
    /user_id\s*=\s*\(?\s*SELECT\s+(?:\(\s*SELECT\s+)?auth\.uid\(\)/i,
} as const;

const POLICY_EXCLUSION_PATTERNS = {
  select_policy_is_expected: '(^|[^[:alnum:]_])(NOT|AND)([^[:alnum:]_]|$)',
  insert_policy_allows_owner: '(^|[^[:alnum:]_])(NOT|AND|OR)([^[:alnum:]_]|$)',
} as const;

const POLICY_EXCLUSION_REGEXES = {
  select_policy_is_expected: /(^|[^A-Za-z0-9_])(NOT|AND)([^A-Za-z0-9_]|$)/i,
  insert_policy_allows_owner: /(^|[^A-Za-z0-9_])(NOT|AND|OR)([^A-Za-z0-9_]|$)/i,
} as const;

type PolicyInvariant = keyof typeof POLICY_OWNERSHIP_PATTERNS;

function extractPolicyRegexPattern(
  invariant: string,
  operator: '~*' | '!~*'
): string {
  const invariantMarker = `'${invariant}'`;
  const invariantStart = migrationSql.indexOf(invariantMarker);
  if (invariantStart === -1) {
    throw new Error(`Missing policy invariant ${invariant}`);
  }

  const section = migrationSql.slice(invariantStart + invariantMarker.length);
  const operatorMarker = `${operator} '`;
  const patternStart = section.indexOf(operatorMarker);
  if (patternStart === -1) {
    throw new Error(`Missing ${operator} pattern for ${invariant}`);
  }

  const valueStart = patternStart + operatorMarker.length;
  const valueEnd = section.indexOf("'", valueStart);
  if (valueEnd === -1) {
    throw new Error(`Unterminated ${operator} pattern for ${invariant}`);
  }

  return section.slice(valueStart, valueEnd);
}

function policyOwnershipRegex(invariant: string): RegExp {
  const policyInvariant = invariant as PolicyInvariant;
  expect(extractPolicyRegexPattern(invariant, '~*')).toBe(
    POLICY_OWNERSHIP_PATTERNS[policyInvariant]
  );
  return POLICY_OWNERSHIP_REGEXES[policyInvariant];
}

function policyExclusionRegex(invariant: string): RegExp {
  const policyInvariant = invariant as PolicyInvariant;
  expect(extractPolicyRegexPattern(invariant, '!~*')).toBe(
    POLICY_EXCLUSION_PATTERNS[policyInvariant]
  );
  return POLICY_EXCLUSION_REGEXES[policyInvariant];
}

function canonicalOwnerPredicate(expression: string): string {
  return expression
    .replace(/SELECT|AS\s+uid|public\.|::text/gi, '')
    .replace(/[\s()'"]/g, '')
    .toLowerCase();
}

function canonicalUpdatePredicate(expression: string): string {
  return expression
    .replace(/SELECT|AS\s+uid|public\.|::text/gi, '')
    .replace(/[\s()'"]/g, '');
}

describe('merchant signup policy health migration', () => {
  it('checks the exact read and write policy contracts', () => {
    const selectPolicySection = migrationSql
      .split("'select_policy_is_expected'")[1]
      ?.split("'insert_policy_allows_owner'")[0];

    expect(migrationSql).toContain(
      "policy.polname = 'Authenticated can view merchants'"
    );
    expect(migrationSql).toContain("policy.polcmd = 'r'");
    expect(migrationSql).toContain('is_published[[:space:]]+IS');
    expect(migrationSql).toContain('has_merchant_access[(]id[)]');
    expect(migrationSql).toContain(
      "policy.polname = 'Owner and staff can modify merchants'"
    );
    expect(migrationSql).toContain("policy.polcmd = 'a'");
    expect(migrationSql).toContain(
      'policy.polroles = ARRAY[0::pg_catalog.oid]'
    );
    expect(migrationSql).toContain(
      "policy.polname = 'Consolidated update permissions'"
    );
    expect(migrationSql).toContain("policy.polcmd = 'w'");
    expect(migrationSql).toContain(
      'check_staff_permissionauth.uid,id,settings,edit'
    );
    expect(migrationSql).toContain('policy.polwithcheck IS NULL');
    expect(migrationSql).toContain("= 'user_id=auth.uid'");
    expect(migrationSql).toContain(
      "= 'is_publishedistrueoruser_id=auth.uidorhas_merchant_accessid'"
    );
    expect(selectPolicySection).toContain(
      'pg_catalog.lower(pg_catalog.regexp_replace('
    );
    expect(migrationSql).toContain(
      "= 'user_id=auth.uidORcheck_staff_permissionauth.uid,id,settings,edit'"
    );
    expect(migrationSql).toContain("'no_restrictive_signup_policies'");
    expect(migrationSql).toContain('policy.polpermissive IS FALSE');
    expect(migrationSql).toContain('pg_catalog.pg_has_role(');
    expect(migrationSql).toContain("'USAGE'");
    expect(migrationSql).not.toContain("'MEMBER'");
    expect(migrationSql).toContain("'row_level_security_enabled'");
    expect(migrationSql).toContain('relation.relrowsecurity');
    expect(migrationSql).toContain("'auth_can_use_public_schema'");
    expect(migrationSql).toContain('pg_catalog.has_schema_privilege(');
    expect(migrationSql).toContain(
      "'no_unexpected_permissive_signup_policies'"
    );
    expect(migrationSql).toContain("'auth_has_no_table_select'");
    expect(migrationSql).toContain("'alias_row_level_security_enabled'");
    expect(migrationSql).toContain("'alias_select_policy_is_expected'");
    expect(migrationSql).toContain("'slug aliases are publicly readable'");
    expect(migrationSql).toContain("'no_restrictive_alias_select_policies'");
    expect(migrationSql).toContain("'anon_select_policy_is_expected'");
    expect(migrationSql).toContain("'Anon can view merchants'");
    expect(migrationSql).toContain(
      "'no_restrictive_anon_merchant_select_policies'"
    );
    expect(migrationSql).toContain(
      "'no_unexpected_permissive_anon_merchant_select_policies'"
    );
    expect(migrationSql).toContain("'anon_can_use_public_schema'");
    expect(migrationSql).toContain("'anon_has_no_alias_table_select'");
    expect(migrationSql).toContain("'anon_has_no_merchant_table_select'");
    expect(migrationSql).toContain("'auth_has_no_alias_table_select'");
  });

  it.each([
    ['select_policy_is_expected', 'user_id = ( SELECT auth.uid() AS uid)'],
    [
      'insert_policy_allows_owner',
      'user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)',
    ],
  ])('matches the canonical owner predicate for %s', (invariant, expression) => {
    expect(policyOwnershipRegex(invariant).test(expression)).toBe(true);
  });

  it.each([
    ['insert_policy_allows_owner', 'user_id = ( SELECT current_user)'],
    [
      'insert_policy_allows_owner',
      'user_id = ( SELECT ( SELECT ( SELECT auth.uid())))',
    ],
  ])('rejects a malformed owner predicate for %s', (invariant, expression) => {
    expect(policyOwnershipRegex(invariant).test(expression)).toBe(false);
  });

  it.each([
    ['select_policy_is_expected', 'NOT (user_id = (SELECT auth.uid()))'],
    ['insert_policy_allows_owner', 'NOT (user_id = (SELECT auth.uid()))'],
  ])('rejects negation in %s', (invariant, expression) => {
    expect(policyExclusionRegex(invariant).test(expression)).toBe(true);
  });

  it.each([
    ['user_id = ( SELECT ( SELECT auth.uid() AS uid) AS uid)', true],
    ['(user_id = (SELECT auth.uid())) IS FALSE', false],
    ['(user_id = (SELECT auth.uid())) IS NOT TRUE', false],
  ])('normalizes the INSERT owner predicate %s to %s', (expression, expected) => {
    expect(canonicalOwnerPredicate(expression) === 'user_id=auth.uid').toBe(
      expected
    );
  });

  it.each([
    [
      "user_id = (SELECT (SELECT auth.uid() AS uid) AS uid) OR public.check_staff_permission((SELECT (SELECT auth.uid() AS uid) AS uid), id, 'settings'::text, 'edit'::text)",
      true,
    ],
    [
      "user_id = (SELECT auth.uid()) OR public.check_staff_permission(auth.uid(), id, 'settings', 'edit') IS FALSE",
      false,
    ],
    [
      "user_id = (SELECT auth.uid()) OR public.check_staff_permission(auth.uid(), id, 'orders', 'edit')",
      false,
    ],
    [
      "user_id = (SELECT auth.uid()) OR public.check_staff_permission(auth.uid(), id, 'SETTINGS', 'EDIT')",
      false,
    ],
  ])('pins the UPDATE owner-or-staff predicate %s to %s', (expression, expected) => {
    expect(
      canonicalUpdatePredicate(expression) ===
        'user_id=auth.uidORcheck_staff_permissionauth.uid,id,settings,edit'
    ).toBe(expected);
  });

  it.each([
    [
      'is_published IS TRUE OR user_id = (SELECT auth.uid() AS uid) OR public.has_merchant_access(id)',
      true,
    ],
    [
      'is_published IS TRUE OR (user_id = (SELECT auth.uid())) IS FALSE OR public.has_merchant_access(id)',
      false,
    ],
  ])('normalizes the SELECT predicate %s to %s', (expression, expected) => {
    expect(
      canonicalOwnerPredicate(expression) ===
        'is_publishedistrueoruser_id=auth.uidorhas_merchant_accessid'
    ).toBe(expected);
  });

  it('checks every table and column privilege used before merchant creation', () => {
    expect(migrationSql).toContain("'auth_can_insert'");
    expect(migrationSql).toContain("'auth_can_update'");
    expect(migrationSql).toContain("'can_read_id'");
    expect(migrationSql).toContain("'can_read_slug'");
    expect(migrationSql).toContain("'can_read_business_name'");
    expect(migrationSql).toContain("'can_read_user_id'");
    expect(migrationSql).toContain("'anon_can_read_alias_old_slug'");
    expect(migrationSql).toContain("'anon_can_read_alias_merchant_id'");
    expect(migrationSql).toContain("'anon_can_read_merchant_id'");
    expect(migrationSql).toContain("'anon_can_read_merchant_slug'");
    expect(migrationSql).toContain("'auth_can_read_alias_old_slug'");
    expect(migrationSql).toContain("'auth_can_read_alias_merchant_id'");
  });

  it('checks helper execution privileges used during slug creation', () => {
    expect(migrationSql).toContain("'auth_can_execute_reserved_slug_check'");
    expect(migrationSql).toContain("'public.is_reserved_merchant_slug(text)'");
    expect(migrationSql).toContain("'auth_can_execute_slug_generator'");
    expect(migrationSql).toContain("'public.generate_slug(text)'");
    expect(migrationSql).toContain('pg_catalog.has_function_privilege(');
  });

  it('pins the definer search path and exposes only the bounded facts to anon', () => {
    expect(migrationSql).toContain('SECURITY DEFINER');
    expect(migrationSql).toContain("SET search_path = ''");
    expect(migrationSql).toContain(
      'REVOKE ALL ON FUNCTION public.get_merchant_signup_policy_health() FROM PUBLIC'
    );
    expect(migrationSql).toContain('FROM authenticated, service_role');
    expect(migrationSql).toContain(
      'GRANT EXECUTE ON FUNCTION public.get_merchant_signup_policy_health() TO anon'
    );
  });

  it('extends health with the exact mobile provisioning function grants', () => {
    expect(provisioningMigrationSql).toContain(
      'CREATE OR REPLACE FUNCTION public.get_merchant_signup_policy_health()'
    );
    expect(provisioningMigrationSql).toContain(
      "'mobile_provisioning_rpc_is_invoker'"
    );
    expect(provisioningMigrationSql).toContain(
      "'auth_can_execute_mobile_provisioning_rpc'"
    );
    expect(provisioningMigrationSql).toContain(
      "'anon_cannot_execute_mobile_provisioning_rpc'"
    );
    expect(provisioningMigrationSql).toContain(
      "'public_cannot_execute_mobile_provisioning_rpc'"
    );
    expect(provisioningMigrationSql).toContain('prosecdef IS FALSE');
    expect(provisioningMigrationSql).toContain(
      "'public.provision_mobile_merchant_v2(text,text,text,text,text,text,text,text,boolean,text,jsonb,text)'"
    );
    expect(provisioningMigrationSql).toContain(
      'REVOKE ALL ON FUNCTION public.provision_mobile_merchant_v2'
    );
    expect(provisioningMigrationSql).toContain(
      'GRANT EXECUTE ON FUNCTION public.provision_mobile_merchant_v2'
    );
  });
});

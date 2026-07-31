import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationDirectory = resolve(process.cwd(), '../../supabase/migrations');
const migrationPath = resolve(
  migrationDirectory,
  '20260730000100_audit_merchant_identity_changes.sql'
);
const extensionMigrationNames = [
  '20260730000101_audit_merchant_identity_schema_guard.sql',
  '20260730000102_audit_merchant_identity_bounded_payload_router.sql',
  '20260730000103_audit_merchant_identity_oversized_cleanup.sql',
  '20260730000104_audit_merchant_identity_oversized_cleanup_triggers.sql',
  '20260730000105_audit_merchant_identity_raw_social_change.sql',
  '20260730000106_audit_merchant_identity_trigger_predicate_permissions.sql',
] as const;
const extensionMigrationPaths = extensionMigrationNames.map((fileName) =>
  resolve(migrationDirectory, fileName)
);
const sqlRegressionPath = resolve(
  migrationDirectory,
  'tests/audit_merchant_identity_changes.sql'
);
const sqlRegressionPartPaths = [
  'tests/audit_merchant_identity_changes/000_trigger_predicate_permissions.sql',
  'tests/audit_merchant_identity_changes/001_setup_and_guard.sql',
  'tests/audit_merchant_identity_changes/002_update_and_safe_social.sql',
  'tests/audit_merchant_identity_changes/003_raw_social_and_lifecycle.sql',
  'tests/audit_merchant_identity_changes/004_lifecycle_and_delete.sql',
].map((fileName) => resolve(migrationDirectory, fileName));

const exactFields = [
  'business_name',
  'country',
  'email_logo_url',
  'email_sender_name',
  'favicon_apple_touch_url',
  'favicon_png_192_url',
  'favicon_png_32_url',
  'favicon_svg_url',
  'is_published',
  'legal_entity_name',
  'logo_url',
  'site_description',
  'site_tagline',
  'site_title',
  'slug',
  'social_media',
  'support_email',
  'support_phone',
] as const;

const presenceOnlyFields = [
  'business_address',
  'email',
  'lga_code',
  'phone',
  'registered_address',
  'state_code',
] as const;

const governedFields = [...exactFields, ...presenceOnlyFields];

describe('merchant identity audit migration contract', () => {
  it('preserves the original migration and appends ordered remediation versions', () => {
    const matchingMigrationFiles = readdirSync(migrationDirectory).filter(
      (fileName) => fileName.startsWith('20260730000100_')
    );
    const appendedMigrationFiles = readdirSync(migrationDirectory)
      .filter((fileName) =>
        extensionMigrationNames.includes(
          fileName as (typeof extensionMigrationNames)[number]
        )
      )
      .sort();

    expect(matchingMigrationFiles).toEqual([
      '20260730000100_audit_merchant_identity_changes.sql',
    ]);
    expect(appendedMigrationFiles).toEqual(extensionMigrationNames);
  });

  it('installs an owner-confined bounded legacy writer behind a catch-all schema guard', () => {
    const originalMigrationSql = readFileSync(migrationPath, 'utf8');
    const [
      guardSql,
      routerSql,
      cleanupSql,
      cleanupTriggerSql,
      rawSocialSql,
      predicatePermissionSql,
    ] = extensionMigrationPaths.map((path) => readFileSync(path, 'utf8'));

    expect(originalMigrationSql).toContain(
      'CREATE OR REPLACE FUNCTION private.audit_merchant_identity_change_v1()'
    );
    expect(originalMigrationSql).toContain(
      'AFTER INSERT OR DELETE OR UPDATE OF'
    );
    expect(originalMigrationSql).toContain('private.write_audit_event_v1(');

    expect(guardSql).toContain(
      'CREATE OR REPLACE FUNCTION private.assert_merchant_identity_schema_classified_v2()'
    );
    expect(guardSql).toContain(
      'BEFORE INSERT OR DELETE OR UPDATE ON public.merchants'
    );
    expect(guardSql).toContain('audit_merchant_identity_unclassified_column');
    expect(guardSql).toContain("SET search_path = ''");
    expect(guardSql).toContain('SECURITY DEFINER');
    expect(guardSql).toContain('OWNER TO postgres');
    expect(guardSql).toContain(
      'REVOKE ALL ON FUNCTION private.assert_merchant_identity_schema_classified_v2()'
    );

    expect(routerSql).toContain(
      'DROP TRIGGER IF EXISTS audit_merchant_identity_change_v1 ON public.merchants'
    );
    expect(routerSql).toContain(
      'CREATE TRIGGER audit_merchant_identity_legacy_update_v2'
    );
    expect(routerSql).toContain('WHEN (');
    for (const field of governedFields) {
      expect(routerSql).toContain(field);
    }
    expect(routerSql).toContain(
      'private.merchant_identity_audit_row_is_bounded_v2(OLD)'
    );
    expect(routerSql).toContain(
      'OLD.social_media IS DISTINCT FROM NEW.social_media'
    );
    expect(routerSql).toContain(
      'IS NOT DISTINCT FROM private.project_merchant_social_media_for_audit_v1(NEW.social_media)'
    );
    expect(routerSql).toContain('SECURITY DEFINER');
    expect(routerSql).toContain("SET search_path = ''");
    expect(routerSql).toContain('OWNER TO postgres');
    expect(routerSql).toContain(
      'REVOKE ALL ON FUNCTION private.merchant_identity_audit_row_is_bounded_v2(public.merchants)'
    );

    expect(cleanupSql).toContain(
      'CREATE OR REPLACE FUNCTION private.audit_merchant_identity_oversized_cleanup_v2()'
    );
    expect(cleanupSql).toContain(
      "'state', 'redacted', 'reason', 'oversized_legacy_payload'"
    );
    expect(cleanupSql).toContain('SECURITY DEFINER');
    expect(cleanupSql).toContain("SET search_path = ''");
    expect(cleanupSql).toContain('OWNER TO postgres');
    expect(cleanupSql).toContain(
      'REVOKE ALL ON FUNCTION private.audit_merchant_identity_oversized_cleanup_v2()'
    );
    expect(cleanupTriggerSql).toContain(
      'CREATE TRIGGER audit_merchant_identity_cleanup_update_v2'
    );
    expect(cleanupTriggerSql).not.toContain(
      'CREATE TRIGGER audit_merchant_identity_cleanup_insert_v2'
    );
    expect(cleanupTriggerSql).toContain(
      'NOT private.merchant_identity_audit_row_is_bounded_v2(OLD)'
    );

    expect(rawSocialSql).toContain(
      'CREATE OR REPLACE FUNCTION private.audit_merchant_identity_raw_social_change_v2()'
    );
    expect(rawSocialSql).toContain(
      'OLD.social_media IS DISTINCT FROM NEW.social_media'
    );
    expect(rawSocialSql).toContain(
      'IS NOT DISTINCT FROM private.project_merchant_social_media_for_audit_v1'
    );
    expect(rawSocialSql).toContain('v_old_row := pg_catalog.to_jsonb(OLD)');
    expect(rawSocialSql).toContain('v_new_row := pg_catalog.to_jsonb(NEW)');
    expect(rawSocialSql).toContain("IF v_field = 'social_media' THEN");
    expect(rawSocialSql).toContain('v_presence_fields text[]');
    expect(rawSocialSql).toContain('audit_merchant_identity_payload_too_large');
    expect(rawSocialSql).toContain('SECURITY DEFINER');
    expect(rawSocialSql).toContain("SET search_path = ''");
    expect(rawSocialSql).toContain('OWNER TO postgres');
    expect(rawSocialSql).toContain(
      'REVOKE ALL ON FUNCTION private.audit_merchant_identity_raw_social_change_v2()'
    );
    expect(predicatePermissionSql).toContain(
      'private.merchant_identity_audit_row_is_bounded_v2(public.merchants)'
    );
    expect(predicatePermissionSql).toContain(
      'private.project_merchant_social_media_for_audit_v1(jsonb)'
    );
    expect(predicatePermissionSql).toContain('FROM PUBLIC, anon');
    expect(predicatePermissionSql).toContain('TO authenticated, service_role');
  });

  it('uses explicit projections and an exhaustive immutable classification', () => {
    const migrationSql = readFileSync(migrationPath, 'utf8');

    for (const field of exactFields) {
      expect(migrationSql).toContain(`'${field}'`);
    }
    for (const field of presenceOnlyFields) {
      expect(migrationSql).toContain(`'${field}'`);
    }
    expect(migrationSql).toContain(
      'audit_merchant_identity_classification_invalid'
    );
    expect(migrationSql).toContain(
      'audit_merchant_identity_unclassified_column'
    );
    expect(migrationSql).toContain('octet_length(v_before_values::text)');
    expect(migrationSql).toContain('merchant.identity.create');
    expect(migrationSql).toContain('merchant.identity.update');
    expect(migrationSql).toContain('merchant.identity.delete');
    expect(migrationSql).toContain(
      'private.project_merchant_social_media_for_audit_v1'
    );
    expect(migrationSql).toContain(
      'REVOKE ALL ON FUNCTION private.project_merchant_social_media_for_audit_v1(jsonb)'
    );
    expect(migrationSql).toContain('octet_length(v_value) > 255');
    expect(migrationSql).not.toMatch(/to_jsonb\(\s*(?:OLD|NEW)\s*\)/);
    expect(migrationSql).not.toMatch(/(?:left|substring)\s*\(/i);
  });

  it('ships split executable regressions for guard, raw social, and oversized cleanup paths', () => {
    const wrapperSql = readFileSync(sqlRegressionPath, 'utf8');
    const sqlRegression = sqlRegressionPartPaths
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');

    expect(wrapperSql).toContain(
      '\\ir audit_merchant_identity_changes/000_trigger_predicate_permissions.sql'
    );
    expect(wrapperSql).toContain(
      '\\ir audit_merchant_identity_changes/001_setup_and_guard.sql'
    );
    expect(wrapperSql).toContain(
      '\\ir audit_merchant_identity_changes/004_lifecycle_and_delete.sql'
    );
    expect(sqlRegression).toContain('information_schema.columns');
    expect(sqlRegression).toContain(
      "has_schema_privilege('authenticated', 'private', 'USAGE')"
    );
    expect(sqlRegression).toContain("'service_role', v_helper, 'EXECUTE'");
    expect(sqlRegression).toContain('pqthhi');
    expect(sqlRegression).toContain('merchant.identity.update');
    expect(sqlRegression).toContain('audit_merchant_identity_change_v1');
    expect(sqlRegression).toContain('ROLLBACK TO SAVEPOINT');
    expect(sqlRegression).toContain('SET audit_identity_unclassified_probe =');
    expect(sqlRegression).toContain('update_merchant_social_media');
    expect(sqlRegression).toContain('service_role');
    expect(sqlRegression).toContain('facebook-capi-secret');
    expect(sqlRegression).toContain('raw-social-equal-before');
    expect(sqlRegression).toContain('Raw social combined title');
    expect(sqlRegression).toContain('another-social-secret');
    expect(sqlRegression).toContain('untrusted-social-scalar');
    expect(sqlRegression).toContain('untrusted-social-array');
    expect(sqlRegression).toContain('oversized_legacy_payload');
    expect(sqlRegression).toContain('oversized identity cleanup');
    expect(sqlRegression).toContain('oversized identity deletion');
    expect(sqlRegression).toContain('oversized-new-sentinel-');
    expect(sqlRegression).toContain(
      'DISABLE TRIGGER audit_merchant_identity_legacy_update_v2'
    );
    expect(sqlRegression).toContain('updated_at-only');
  });
});

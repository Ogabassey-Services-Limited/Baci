import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationDirectory = resolve(process.cwd(), '../../supabase/migrations');
const migrationPath = resolve(
  migrationDirectory,
  '20260730000100_audit_merchant_identity_changes.sql'
);
const sqlRegressionPath = resolve(
  migrationDirectory,
  'tests/audit_merchant_identity_changes.sql'
);

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
  it('uses the reserved migration version exactly once', () => {
    const matchingMigrationFiles = readdirSync(migrationDirectory).filter(
      (fileName) => fileName.startsWith('20260730000100_')
    );

    expect(matchingMigrationFiles).toEqual([
      '20260730000100_audit_merchant_identity_changes.sql',
    ]);
  });

  it('installs an owner-confined AFTER trigger that uses Task 1’s opaque writer capability', () => {
    const migrationSql = readFileSync(migrationPath, 'utf8');

    expect(migrationSql).toContain(
      'CREATE OR REPLACE FUNCTION private.audit_merchant_identity_change_v1()'
    );
    expect(migrationSql).toContain('SECURITY DEFINER');
    expect(migrationSql).toContain("SET search_path = ''");
    expect(migrationSql).toContain(
      'FROM private.audit_event_writer_capabilities AS capability'
    );
    expect(migrationSql).toContain(
      "capability.capability_name = 'canonical_audit_event_writer_v1'"
    );
    expect(migrationSql).toContain('private.write_audit_event_v1(');
    expect(migrationSql).toContain(
      'REVOKE ALL ON FUNCTION private.audit_merchant_identity_change_v1()'
    );
    expect(migrationSql).toContain('AFTER INSERT OR DELETE OR UPDATE OF');
    expect(migrationSql).toContain('ON public.merchants');
    expect(migrationSql).toContain(
      'EXECUTE FUNCTION private.audit_merchant_identity_change_v1()'
    );
    expect(migrationSql).not.toContain(
      'GRANT EXECUTE ON FUNCTION private.audit_merchant_identity_change_v1()'
    );

    const triggerSql =
      migrationSql.match(
        /CREATE TRIGGER audit_merchant_identity_change_v1[\s\S]*?;/
      )?.[0] ?? '';
    expect(triggerSql).toContain('AFTER INSERT OR DELETE OR UPDATE OF');
    for (const field of governedFields) {
      expect(triggerSql).toContain(field);
    }
  });

  it('uses explicit public projections, presence-only private values, and an exhaustive classification', () => {
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

  it('ships the executable SQL regression for redaction, attribution, and replay-schema coverage', () => {
    const sqlRegression = readFileSync(sqlRegressionPath, 'utf8');

    expect(sqlRegression).toContain('information_schema.columns');
    expect(sqlRegression).toContain('pqthhi');
    expect(sqlRegression).toContain('merchant.identity.update');
    expect(sqlRegression).toContain('audit_merchant_identity_change_v1');
    expect(sqlRegression).toContain('ROLLBACK TO SAVEPOINT');
    expect(sqlRegression).toContain('audit_identity_unclassified_probe');
    expect(sqlRegression).toContain('update_merchant_social_media');
    expect(sqlRegression).toContain('service_role');
    expect(sqlRegression).toContain('facebook-capi-secret');
    expect(sqlRegression).toContain('unsafe-social-before');
    expect(sqlRegression).toContain('linkedin.evil.example');
    expect(sqlRegression).toContain('audit_safe_handle');
    expect(sqlRegression).toContain('untrusted-social-scalar');
    expect(sqlRegression).toContain('untrusted-social-array');
    expect(sqlRegression).toContain('normalized social handle');
    expect(sqlRegression).toContain('updated_at-only');
  });
});

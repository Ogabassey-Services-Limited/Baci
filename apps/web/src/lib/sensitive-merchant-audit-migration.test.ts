import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationDirectory = resolve(process.cwd(), '../../supabase/migrations');
const migrationPath = resolve(
  migrationDirectory,
  '20260730000300_audit_sensitive_merchant_configuration.sql'
);
const triggerRemediationPath = resolve(
  migrationDirectory,
  '20260730000301_audit_sensitive_merchant_configuration_all_column_trigger.sql'
);
const sqlRegressionPath = resolve(
  migrationDirectory,
  'tests/audit_sensitive_merchant_configuration.sql'
);
const sqlRegressionPartPaths = [
  'tests/audit_sensitive_merchant_configuration/001_setup_and_guard.sql',
  'tests/audit_sensitive_merchant_configuration/002_configuration_and_clear.sql',
  'tests/audit_sensitive_merchant_configuration/003_kyc_and_grouping.sql',
  'tests/audit_sensitive_merchant_configuration/004_create_delete_and_rollback.sql',
].map((fileName) => resolve(migrationDirectory, fileName));

const exactFields = [
  'email_domain_verified',
  'gmc_variants_enabled',
  'is_platform_admin',
  'kyc_status',
  'multi_currency_enabled',
  'offline_conversions_enabled',
  'payout_currency',
  'plan_tier',
  'tax_exempt',
  'vat_rate',
  'vat_registration_status',
] as const;

const presenceOnlyFields = [
  'bank_account_name',
  'bank_account_number',
  'bank_code',
  'bank_name',
  'bvn',
  'cac_number',
  'cac_rc_number',
  'email_domain',
  'endpoint_id',
  'endpoint_scheme_id',
  'facebook_capi_access_token',
  'facebook_capi_token',
  'facebook_pixel_id',
  'feature_settings',
  'firs_business_id',
  'firs_certificate',
  'firs_email',
  'firs_password_encrypted',
  'firs_public_key',
  'firs_service_id',
  'ga4_api_secret',
  'google_analytics_id',
  'google_product_sheet_url',
  'nin',
  'paystack_subaccount_code',
  'premium_features',
  'rider_phone_number',
  'snapchat_capi_token',
  'snapchat_pixel_id',
  'stripe_customer_id',
  'stripe_subscription_id',
  'tax_identification_number',
  'tiktok_access_token',
  'tiktok_pixel_id',
  'twitter_pixel_id',
  'user_id',
  'virtual_terminal_code',
] as const;

const task2OwnedFields = [
  'about_page',
  'brand_colors',
  'business_address',
  'business_name',
  'business_type',
  'country',
  'created_at',
  'email',
  'email_logo_url',
  'email_sender_name',
  'faq_items',
  'favicon_apple_touch_url',
  'favicon_png_192_url',
  'favicon_png_32_url',
  'favicon_svg_url',
  'favicon_uploaded_at',
  'hero_image_ids',
  'hero_images_generated_at',
  'hero_images_regeneration_count',
  'hero_slides',
  'id',
  'is_published',
  'legal_entity_name',
  'lga_code',
  'logo_url',
  'mobile_hero_slides',
  'order_prefix',
  'pages',
  'phone',
  'plan_expires_at',
  'plan_started_at',
  'published_at',
  'published_config',
  'registered_address',
  'self_fulfillment_enabled',
  'signup_source',
  'site_description',
  'site_tagline',
  'site_title',
  'slug',
  'social_media',
  'state_code',
  'support_email',
  'support_phone',
  'template_id',
  'trust_profile',
  'updated_at',
] as const;

describe('sensitive merchant configuration audit migration contract', () => {
  it('reserves the Task 4 migration version exactly once', () => {
    const matchingMigrationFiles = readdirSync(migrationDirectory).filter(
      (fileName) => fileName.startsWith('20260730000300_')
    );

    expect(matchingMigrationFiles).toEqual([
      '20260730000300_audit_sensitive_merchant_configuration.sql',
    ]);
  });

  it('supersedes the limited trigger with an all-column fail-closed trigger', () => {
    const migrationSql = readFileSync(migrationPath, 'utf8');
    const remediationSql = readFileSync(triggerRemediationPath, 'utf8');

    expect(migrationSql).toContain(
      'CREATE OR REPLACE FUNCTION private.audit_sensitive_merchant_configuration_change_v1()'
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
      'REVOKE ALL ON FUNCTION private.audit_sensitive_merchant_configuration_change_v1()'
    );
    expect(migrationSql).not.toContain(
      'GRANT EXECUTE ON FUNCTION private.audit_sensitive_merchant_configuration_change_v1()'
    );

    expect(remediationSql).toContain(
      'DROP TRIGGER IF EXISTS audit_sensitive_merchant_configuration_change_v1 ON public.merchants'
    );
    expect(remediationSql).toContain(
      'CREATE TRIGGER audit_sensitive_merchant_configuration_change_v1'
    );
    expect(remediationSql).toContain(
      'AFTER INSERT OR DELETE OR UPDATE ON public.merchants'
    );
    expect(remediationSql).not.toContain('UPDATE OF');
    expect(remediationSql).toContain(
      'EXECUTE FUNCTION private.audit_sensitive_merchant_configuration_change_v1()'
    );
  });

  it('uses a closed, disjoint classification and never serializes a merchant row', () => {
    const migrationSql = readFileSync(migrationPath, 'utf8');
    const classifiedFields = [
      ...task2OwnedFields,
      ...exactFields,
      ...presenceOnlyFields,
    ];

    expect(new Set(classifiedFields).size).toBe(classifiedFields.length);
    expect(classifiedFields).toHaveLength(95);
    for (const field of classifiedFields) {
      expect(migrationSql).toContain(`'${field}'`);
    }
    expect(migrationSql).toContain(
      'audit_sensitive_merchant_configuration_classification_invalid'
    );
    expect(migrationSql).toContain(
      'audit_sensitive_merchant_configuration_unclassified_column'
    );
    expect(migrationSql).toContain('octet_length(v_before_values::text)');
    expect(migrationSql).toContain('merchant.configuration.create');
    expect(migrationSql).toContain('merchant.configuration.update');
    expect(migrationSql).toContain('merchant.configuration.delete');
    expect(migrationSql).not.toMatch(/to_jsonb\(\s*(?:OLD|NEW)\s*\)/);
  });

  it('ships executable redaction, transaction-grouping, and current-schema regressions', () => {
    const wrapperSql = readFileSync(sqlRegressionPath, 'utf8');
    const sqlRegression = sqlRegressionPartPaths
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');

    expect(wrapperSql).toContain(
      '\\ir audit_sensitive_merchant_configuration/001_setup_and_guard.sql'
    );
    expect(wrapperSql).toContain(
      '\\ir audit_sensitive_merchant_configuration/004_create_delete_and_rollback.sql'
    );
    expect(sqlRegression).toContain('information_schema.columns');
    expect(sqlRegression).toContain('task4-bank-number-sentinel');
    expect(sqlRegression).toContain('task4-nin-sentinel');
    expect(sqlRegression).toContain('task4-bvn-sentinel');
    expect(sqlRegression).toContain('task4-tin-sentinel');
    expect(sqlRegression).toContain('task4-certificate-sentinel');
    expect(sqlRegression).toContain('task4-firs-password-sentinel');
    expect(sqlRegression).toContain('task4-analytics-token-sentinel');
    expect(sqlRegression).toContain('task4-delete-bank-number-sentinel');
    expect(sqlRegression).toContain("position('task4-delete-'");
    expect(sqlRegression).toContain('pg_catalog.to_jsonb(audit_event)');
    expect(sqlRegression).toContain('merchant.configuration.update');
    expect(sqlRegression).toContain('merchant.configuration.delete');
    expect(sqlRegression).toContain('database_transaction_id');
    expect(sqlRegression).toContain('paystack_subaccount_code');
    expect(sqlRegression).toContain('record_nin_verification');
    expect(sqlRegression).toContain('record_bvn_verification');
    expect(sqlRegression).toContain('record_cac_verification');
    expect(sqlRegression).toContain('payout_currency');
    expect(sqlRegression).toContain('updated_at = updated_at + interval');
    expect(sqlRegression).toContain('ROLLBACK TO SAVEPOINT');
    expect(sqlRegression).toContain(
      'COALESCE(pg_catalog.cardinality(p_sentinels), 0) = 0'
    );
    expect(sqlRegression).toContain('NULL::text[]');
    expect(sqlRegression).toContain('ARRAY[]::text[]');
    expect(sqlRegression).toContain(
      'SET audit_sensitive_merchant_configuration_unclassified_probe ='
    );
    expect(sqlRegression).toContain(
      'audit_sensitive_merchant_configuration_unclassified_column'
    );
  });
});

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractSqlArrayFields } from '@/lib/test-helpers/extract-sql-array-fields';
import { extractSqlFunction } from '@/lib/test-helpers/extract-sql-function';

const migrationDirectory = resolve(process.cwd(), '../../supabase/migrations');
const migrationPath = resolve(
  migrationDirectory,
  '20260730000400_audit_merchant_feature_settings.sql'
);
const sqlRegression = [
  'audit_merchant_feature_settings.sql',
  'audit_merchant_feature_settings_setup.sql',
  'audit_merchant_feature_settings_primary_mutations.sql',
  'audit_merchant_feature_settings_snapshot_updates.sql',
  'audit_merchant_feature_settings_lifecycle.sql',
]
  .map((fileName) =>
    readFileSync(resolve(migrationDirectory, 'tests', fileName), 'utf8')
  )
  .join('\n');

const exactFields = [
  'about_page_enabled',
  'agentic_checkout_enabled',
  'auto_blog_enabled',
  'auto_generate_schema',
  'blog_discover_image_validation_enabled',
  'blog_enabled',
  'checkout_collect_phone',
  'checkout_require_account',
  'checkout_show_order_notes',
  'contact_page_enabled',
  'credit_direct_enabled',
  'credit_direct_max_amount',
  'credit_direct_min_amount',
  'credpal_enabled',
  'customer_device_savings_auto_debit_enabled',
  'customer_device_savings_break_fee_enabled',
  'customer_device_savings_enabled',
  'discount_codes_enabled',
  'email_notifications_enabled',
  'faq_page_enabled',
  'free_shipping_threshold',
  'google_reviews_enabled',
  'guest_checkout_enabled',
  'juicyway_enabled',
  'klump_enabled',
  'klump_max_amount',
  'klump_min_amount',
  'korapay_enabled',
  'low_stock_threshold',
  'loyalty_enabled',
  'order_tracking_enabled',
  'pay_on_delivery_enabled',
  'paystack_enabled',
  'preferred_international_gateway',
  'preferred_local_gateway',
  'privacy_page_enabled',
  'repairs_catalog_enabled',
  'reviews_enabled',
  'rewards_page_enabled',
  'shipping_insurance_enabled',
  'shipping_insurance_min_order_value',
  'shipping_insurance_opt_in_default',
  'shipping_markup_percentage',
  'show_recent_purchases',
  'show_stock_levels',
  'sms_notifications_enabled',
  'terms_page_enabled',
  'vtu_airtime_enabled',
  'vtu_betting_enabled',
  'vtu_checkout_addon_amounts',
  'vtu_checkout_addon_enabled',
  'vtu_customer_cashback_enabled',
  'vtu_customer_cashback_rate',
  'vtu_data_enabled',
  'vtu_electricity_enabled',
  'vtu_enabled',
  'vtu_loyalty_reward_enabled',
  'vtu_merchant_commission_rate',
  'vtu_tv_enabled',
  'wallet_order_auto_debit_enabled',
  'wallet_paystack_dva_enabled',
  'wishlist_enabled',
] as const;

const presenceOnlyFields = [
  'credit_direct_public_key',
  'custom_settings',
  'facebook_capi_token',
  'facebook_pixel_id',
  'ga4_api_secret',
  'google_analytics_id',
  'google_place_id',
  'repair_settings',
  'shipping_providers',
  'snapchat_capi_token',
  'snapchat_pixel_id',
  'tiktok_access_token',
  'tiktok_pixel_id',
  'twitter_pixel_id',
] as const;

const ignoredFields = 'created_at,custom_robots_txt,updated_at'.split(',');

const forbiddenFields = ['id', 'merchant_id'] as const;

describe('merchant feature settings audit migration contract', () => {
  it('reserves the Task 5 migration version exactly once', () => {
    const matchingMigrationFiles = readdirSync(migrationDirectory).filter(
      (fileName) => fileName.startsWith('20260730000400_')
    );

    expect(matchingMigrationFiles).toEqual([
      '20260730000400_audit_merchant_feature_settings.sql',
    ]);
  });

  it('installs an owner-confined all-column trigger through Task 1’s writer capability', () => {
    const migrationSql = readFileSync(migrationPath, 'utf8');
    const triggerFunctionSql = extractSqlFunction(
      migrationSql,
      'private.audit_merchant_feature_settings_change_v1()'
    );

    expect(triggerFunctionSql).not.toBe('');
    expect(triggerFunctionSql).toContain('SECURITY DEFINER');
    expect(triggerFunctionSql).toContain("SET search_path = ''");
    expect(triggerFunctionSql).toContain(
      'FROM private.audit_event_writer_capabilities AS capability'
    );
    expect(triggerFunctionSql).toContain(
      "capability.capability_name = 'canonical_audit_event_writer_v1'"
    );
    expect(triggerFunctionSql).toContain('private.write_audit_event_v1(');
    expect(migrationSql).toMatch(
      /^REVOKE ALL ON FUNCTION private\.audit_merchant_feature_settings_change_v1\(\)\n {2}FROM PUBLIC, anon, authenticated, service_role;$/m
    );
    expect(migrationSql).not.toMatch(
      /GRANT EXECUTE ON FUNCTION private\.audit_merchant_feature_settings_change_v1\(\)/
    );

    const triggerSql =
      migrationSql.match(
        /CREATE TRIGGER audit_merchant_feature_settings_change_v1[\s\S]*?;/
      )?.[0] ?? '';
    expect(triggerSql).toContain('AFTER INSERT OR DELETE OR UPDATE');
    expect(triggerSql).toContain('ON public.merchant_feature_settings');
    expect(triggerSql).not.toContain('UPDATE OF');
    expect(triggerSql).toContain(
      'EXECUTE FUNCTION private.audit_merchant_feature_settings_change_v1()'
    );
  });

  it('uses an exhaustive closed classification with bounded safe projections', () => {
    const migrationSql = readFileSync(migrationPath, 'utf8');
    const triggerFunctionSql = extractSqlFunction(
      migrationSql,
      'private.audit_merchant_feature_settings_change_v1()'
    );
    const customSettingsHelperSql = extractSqlFunction(
      migrationSql,
      'private.audit_merchant_feature_settings_custom_settings_state_v1('
    );
    const classifiedFields = [
      ...exactFields,
      ...presenceOnlyFields,
      ...ignoredFields,
      ...forbiddenFields,
    ];

    expect(new Set(classifiedFields).size).toBe(classifiedFields.length);
    expect(classifiedFields).toHaveLength(81);
    expect(triggerFunctionSql).not.toBe('');
    expect(customSettingsHelperSql).not.toBe('');
    for (const [fieldGroup, fields] of [
      ['exact', exactFields],
      ['presence', presenceOnlyFields],
      ['ignored', ignoredFields],
      ['forbidden', forbiddenFields],
    ] as const) {
      expect(extractSqlArrayFields(triggerFunctionSql, fieldGroup)).toEqual(
        fields
      );
    }
    expect(triggerFunctionSql).toContain(
      'audit_merchant_feature_settings_classification_invalid'
    );
    expect(triggerFunctionSql).toContain(
      'audit_merchant_feature_settings_unclassified_column'
    );
    expect(triggerFunctionSql).toContain(
      'audit_merchant_feature_settings_id_reassignment_forbidden'
    );
    expect(triggerFunctionSql).toContain(
      'audit_merchant_feature_settings_merchant_reassignment_forbidden'
    );
    expect(triggerFunctionSql).toContain('settings_snapshot');
    expect(triggerFunctionSql).toContain('merchant.feature_settings.create');
    expect(triggerFunctionSql).toContain('merchant.feature_settings.update');
    expect(triggerFunctionSql).toContain('merchant.feature_settings.delete');
    expect(triggerFunctionSql).toContain(
      "'free_shipping_threshold', private.audit_merchant_feature_settings_bounded_number_v1(OLD.free_shipping_threshold, -9999999999.99, 9999999999.99)"
    );
    expect(triggerFunctionSql).toContain(
      "'low_stock_threshold', private.audit_merchant_feature_settings_bounded_number_v1(OLD.low_stock_threshold, -2147483648, 2147483647)"
    );
    expect(triggerFunctionSql).toContain(
      "'free_shipping_threshold', private.audit_merchant_feature_settings_bounded_number_v1(NEW.free_shipping_threshold, -9999999999.99, 9999999999.99)"
    );
    expect(triggerFunctionSql).toContain(
      "'low_stock_threshold', private.audit_merchant_feature_settings_bounded_number_v1(NEW.low_stock_threshold, -2147483648, 2147483647)"
    );
    expect(triggerFunctionSql).toContain(
      'private.audit_merchant_feature_settings_custom_settings_state_v1'
    );
    expect(customSettingsHelperSql).toContain('google_store_widget_enabled');
    expect(triggerFunctionSql).not.toMatch(/to_jsonb\(\s*(?:OLD|NEW)\s*\)/);
    const arbitraryJsonTraversal =
      /\bjsonb_(?:each(?:_text)?|object_keys|array_elements(?:_text)?|to_record(?:set)?|populate_record(?:set)?)\s*\(/i;
    expect(triggerFunctionSql).not.toMatch(arbitraryJsonTraversal);
    expect(customSettingsHelperSql).not.toMatch(arbitraryJsonTraversal);
  });

  it('ships executable redaction, lifecycle, and current-schema regressions', () => {
    expect(sqlRegression).toContain('information_schema.columns');
    expect(sqlRegression).toContain('task5-credit-direct-public-key-sentinel');
    expect(sqlRegression).toContain('task5-facebook-capi-sentinel');
    expect(sqlRegression).toContain('task5-ga4-secret-sentinel');
    expect(sqlRegression).toContain('task5-custom-settings-secret-sentinel');
    expect(sqlRegression).toContain('task5-nested-secret-fragment');
    expect(sqlRegression).toContain('task5-suffix-q7w9');
    expect(sqlRegression).toContain(
      'CREATE FUNCTION pg_temp.assert_task5_redacted_audit_rows('
    );
    expect(sqlRegression).toContain('v_md5 := pg_catalog.md5(v_sentinel);');
    expect(sqlRegression).toContain(
      "v_sha256 := pg_catalog.encode(extensions.digest(v_sentinel, 'sha256'), 'hex');"
    );
    expect(sqlRegression).toContain('pg_catalog.to_jsonb(audit_event)');
    expect(sqlRegression).toContain(
      '\'{"present":true,"state":"rotated","changed_safe_keys":[]}\'::jsonb'
    );
    expect(sqlRegression).toContain('merchant.feature_settings.create');
    expect(sqlRegression).toContain('merchant.feature_settings.update');
    expect(sqlRegression).toContain('merchant.feature_settings.delete');
    expect(sqlRegression).toContain('database_transaction_id');
    expect(sqlRegression).toContain('paystack_enabled');
    expect(sqlRegression).toContain('negative threshold values');
    expect(sqlRegression).toContain('korapay_enabled');
    expect(sqlRegression).toContain('credit_direct_enabled');
    expect(sqlRegression).toContain('juicyway_enabled');
    expect(sqlRegression).toContain('credpal_enabled');
    expect(sqlRegression).toContain('preferred_local_gateway');
    expect(sqlRegression).toContain('checkout_collect_phone');
    expect(sqlRegression).toContain('credit_direct_min_amount');
    expect(sqlRegression).toContain('shipping_providers');
    expect(sqlRegression).toContain('updated_at = updated_at + interval');
    expect(sqlRegression).toContain('SET custom_robots_txt =');
    expect(sqlRegression).toContain('ROLLBACK TO SAVEPOINT');
    expect(sqlRegression).toContain(
      'audit_merchant_feature_settings_unclassified_column'
    );
  });
});

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationsDirectory = resolve(
  __dirname,
  '../../../../supabase/migrations'
);

const migrationSql = readFileSync(
  resolve(
    __dirname,
    '../../../../supabase/migrations/20260611231730_harden_advisor_function_privileges.sql'
  ),
  'utf8'
);

const normalizedMigrationSql = migrationSql.replace(/\s+/g, ' ');

const adminAnalyticsMigrationSql = readFileSync(
  resolve(
    __dirname,
    '../../../../supabase/migrations/20260611232254_harden_admin_analytics_rpc_privileges.sql'
  ),
  'utf8'
);

const normalizedAdminAnalyticsMigrationSql = adminAnalyticsMigrationSql.replace(
  /\s+/g,
  ' '
);

const remainingHelperRpcMigrationFile = readdirSync(migrationsDirectory).find(
  (fileName) => fileName.endsWith('_harden_remaining_helper_rpc_grants.sql')
);

if (!remainingHelperRpcMigrationFile) {
  throw new Error('Remaining helper RPC hardening migration not found');
}

const remainingHelperRpcMigrationSql = readFileSync(
  resolve(migrationsDirectory, remainingHelperRpcMigrationFile),
  'utf8'
);

const normalizedRemainingHelperRpcMigrationSql =
  remainingHelperRpcMigrationSql.replace(/\s+/g, ' ');

describe('Supabase advisor function privilege hardening migration', () => {
  it('pins search path on low-risk advisor functions', () => {
    expect(normalizedMigrationSql).toContain(
      "ALTER FUNCTION public.current_agentic_session_id() SET search_path = ''"
    );
    expect(normalizedMigrationSql).toContain(
      "ALTER FUNCTION public.get_storefront_category_slug_state(uuid, text) SET search_path = ''"
    );
    expect(normalizedMigrationSql).toContain(
      "ALTER FUNCTION private.get_storefront_category_slug_state(uuid, text) SET search_path = ''"
    );
  });

  it('adds tenant or platform-admin guards to privileged helper RPCs', () => {
    expect(migrationSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.get_merchant_balance[\s\S]*SECURITY DEFINER[\s\S]*SET search_path = ''[\s\S]*public\.has_merchant_access\(merchant_id_param\)/i
    );
    expect(migrationSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.get_merchant_push_tokens[\s\S]*SECURITY DEFINER[\s\S]*SET search_path = ''[\s\S]*public\.has_merchant_access\(p_merchant_id\)/i
    );
    expect(migrationSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.decrement_product_stock[\s\S]*public\.has_merchant_access\(v_merchant_id\)/i
    );
    expect(migrationSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.decrement_variant_stock[\s\S]*public\.has_merchant_access\(v_merchant_id\)/i
    );
    expect(migrationSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.set_primary_domain[\s\S]*public\.has_merchant_access\(merchant_id_param\)/i
    );
    expect(migrationSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.send_notification_to_all_merchants[\s\S]*m\.is_platform_admin IS TRUE/i
    );
    expect(migrationSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.send_notification_to_merchants[\s\S]*m\.is_platform_admin IS TRUE/i
    );
  });

  it('removes anonymous execution from authenticated-only helper RPCs', () => {
    const protectedFunctions = [
      'apply_ai_storefront_draft',
      'record_bvn_verification',
      'record_cac_verification',
      'record_nin_verification',
      'save_mobile_admin_product_with_variants',
      'upsert_customer_on_auth',
      'get_merchant_balance',
      'get_merchant_push_tokens',
      'decrement_product_stock',
      'decrement_variant_stock',
      'set_primary_domain',
      'send_notification_to_all_merchants',
      'send_notification_to_merchants',
    ];

    for (const functionName of protectedFunctions) {
      expect(normalizedMigrationSql).toMatch(
        new RegExp(
          `REVOKE EXECUTE ON FUNCTION public\\.${functionName}\\([\\s\\S]*?\\) FROM PUBLIC, anon`,
          'i'
        )
      );
      expect(normalizedMigrationSql).toMatch(
        new RegExp(
          `GRANT EXECUTE ON FUNCTION public\\.${functionName}\\([\\s\\S]*?\\) TO authenticated, service_role`,
          'i'
        )
      );
    }
  });

  it('adds merchant-access guards to legacy admin analytics RPCs', () => {
    const guardedFunctions = [
      'get_analytics_summary',
      'get_monthly_sales_stats',
      'get_sales_by_channel',
      'get_sales_by_payment_method',
      'get_wallet_summary',
    ];

    for (const functionName of guardedFunctions) {
      expect(adminAnalyticsMigrationSql).toMatch(
        new RegExp(
          `CREATE OR REPLACE FUNCTION public\\.${functionName}[\\s\\S]*SECURITY DEFINER[\\s\\S]*SET search_path = ''[\\s\\S]*public\\.has_merchant_access\\(p_merchant_id\\)`,
          'i'
        )
      );
    }
  });

  it('removes anonymous execution from merchant admin RPCs', () => {
    const merchantAdminFunctions = [
      'delete_current_storefront_account',
      'get_analytics_summary',
      'get_merchant_inventory_stats',
      'get_merchant_verification_flags',
      'get_merchant_verification_status',
      'get_mobile_admin_dashboard_stats',
      'get_mobile_admin_revenue_chart',
      'get_monthly_sales_stats',
      'get_sales_by_channel',
      'get_sales_by_payment_method',
      'get_top_products',
      'get_wallet_summary',
    ];

    for (const functionName of merchantAdminFunctions) {
      expect(normalizedAdminAnalyticsMigrationSql).toMatch(
        new RegExp(
          `REVOKE EXECUTE ON FUNCTION public\\.${functionName}\\([\\s\\S]*?\\) FROM PUBLIC, anon`,
          'i'
        )
      );
      expect(normalizedAdminAnalyticsMigrationSql).toMatch(
        new RegExp(
          `GRANT EXECUTE ON FUNCTION public\\.${functionName}\\([\\s\\S]*?\\) TO authenticated, service_role`,
          'i'
        )
      );
    }
  });

  it('guards remaining authenticated helper RPCs with tenant checks', () => {
    expect(remainingHelperRpcMigrationSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.get_or_create_merchant_wallet[\s\S]*SECURITY DEFINER[\s\S]*SET search_path = ''[\s\S]*public\.has_merchant_access\(p_merchant_id\)/i
    );
    expect(remainingHelperRpcMigrationSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.get_staff_permissions[\s\S]*SECURITY DEFINER[\s\S]*SET search_path = ''[\s\S]*v_staff_user_id[\s\S]*public\.has_merchant_access\(v_merchant_id\)/i
    );
    expect(remainingHelperRpcMigrationSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.get_unread_notification_count[\s\S]*SECURITY DEFINER[\s\S]*SET search_path = ''[\s\S]*public\.has_merchant_access\(p_merchant_id\)/i
    );
  });

  it('removes anonymous execution from remaining authenticated helper RPCs', () => {
    const authenticatedHelperFunctions = [
      'get_or_create_merchant_wallet',
      'get_staff_permissions',
      'get_unread_notification_count',
    ];

    for (const functionName of authenticatedHelperFunctions) {
      expect(normalizedRemainingHelperRpcMigrationSql).toMatch(
        new RegExp(
          `REVOKE EXECUTE ON FUNCTION public\\.${functionName}\\([\\s\\S]*?\\) FROM PUBLIC, anon`,
          'i'
        )
      );
      expect(normalizedRemainingHelperRpcMigrationSql).toMatch(
        new RegExp(
          `GRANT EXECUTE ON FUNCTION public\\.${functionName}\\([\\s\\S]*?\\) TO authenticated, service_role`,
          'i'
        )
      );
    }
  });

  it('locks money-moving and internal helper RPCs to the service role', () => {
    const serviceRoleOnlyFunctions = [
      'refund_customer_wallet_for_vtu',
      'get_or_create_customer_wallet',
      'get_merchant_id_for_user',
      'search_order_by_number',
      'is_active_staff_of',
      'calculate_order_vat',
      'generate_order_number_for_merchant',
      'generate_improved_order_number',
    ];

    for (const functionName of serviceRoleOnlyFunctions) {
      expect(normalizedRemainingHelperRpcMigrationSql).toMatch(
        new RegExp(
          `REVOKE EXECUTE ON FUNCTION public\\.${functionName}\\([\\s\\S]*?\\) FROM PUBLIC, anon, authenticated`,
          'i'
        )
      );
      expect(normalizedRemainingHelperRpcMigrationSql).toMatch(
        new RegExp(
          `GRANT EXECUTE ON FUNCTION public\\.${functionName}\\([\\s\\S]*?\\) TO service_role`,
          'i'
        )
      );
    }
  });
});

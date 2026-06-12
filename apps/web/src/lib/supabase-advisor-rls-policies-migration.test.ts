import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationsDirectory = resolve(
  __dirname,
  '../../../../supabase/migrations'
);
const rlsMigrationFile = readdirSync(migrationsDirectory).find((fileName) =>
  fileName.endsWith('_consolidate_permissive_rls_policies.sql')
);

if (!rlsMigrationFile) {
  throw new Error('RLS advisor consolidation migration not found');
}

const migrationSql = readFileSync(
  resolve(migrationsDirectory, rlsMigrationFile),
  'utf8'
);

const normalizedMigrationSql = migrationSql.replace(/\s+/g, ' ');

describe('Supabase advisor RLS policy consolidation migration', () => {
  it('keeps platform-admin and merchant blog write access OR-combined', () => {
    expect(normalizedMigrationSql).toMatch(
      /CREATE POLICY "Authenticated can insert blog posts"[\s\S]*m\.is_platform_admin IS TRUE[\s\S]*OR merchant_id IN[\s\S]*OR public\.check_staff_permission[\s\S]*'marketing'[\s\S]*'create'/i
    );
    expect(normalizedMigrationSql).toMatch(
      /CREATE POLICY "Authenticated can update blog posts"[\s\S]*m\.is_platform_admin IS TRUE[\s\S]*OR merchant_id IN[\s\S]*OR public\.check_staff_permission[\s\S]*'marketing'[\s\S]*'edit'/i
    );
    expect(normalizedMigrationSql).toMatch(
      /CREATE POLICY "Authenticated can delete blog posts"[\s\S]*m\.is_platform_admin IS TRUE[\s\S]*OR merchant_id IN[\s\S]*OR public\.check_staff_permission[\s\S]*'marketing'[\s\S]*'delete'/i
    );
  });

  it('separates anonymous public reads from authenticated merchant reads', () => {
    expect(normalizedMigrationSql).toMatch(
      /CREATE POLICY categories_public_read ON public\.categories FOR SELECT TO anon USING \(is_active = true\)/i
    );
    expect(normalizedMigrationSql).toMatch(
      /CREATE POLICY categories_authenticated_select[\s\S]*FOR SELECT TO authenticated[\s\S]*is_active = true[\s\S]*OR merchant_id IN/i
    );
    expect(normalizedMigrationSql).toMatch(
      /CREATE POLICY "Public can read published blog product links"[\s\S]*FOR SELECT TO anon/i
    );
    expect(normalizedMigrationSql).toMatch(
      /CREATE POLICY "Authenticated can read blog product links"[\s\S]*FOR SELECT TO authenticated[\s\S]*public\.has_merchant_access\(merchant_id\)[\s\S]*OR EXISTS/i
    );
  });

  it('folds agentic access into existing combined policies', () => {
    expect(normalizedMigrationSql).toContain(
      'DROP POLICY IF EXISTS "Agentic chat orders are readable by scoped client" ON public.chat_orders'
    );
    expect(normalizedMigrationSql).toContain(
      'DROP POLICY IF EXISTS "Agentic checkout orders are readable by scoped client" ON public.orders'
    );
    expect(normalizedMigrationSql).toMatch(
      /CREATE POLICY "chat_orders_select_combined"[\s\S]*public\.is_agentic_checkout_context\(\)[\s\S]*public\.current_agentic_session_id\(\)/i
    );
    expect(normalizedMigrationSql).toMatch(
      /CREATE POLICY orders_select_policy[\s\S]*public\.can_access_order\(merchant_id, customer_id\)[\s\S]*public\.is_agentic_checkout_context\(\)/i
    );
  });

  it('splits quiz author writes from combined quiz reads', () => {
    const droppedPolicies = [
      'quiz_events_merchant_author_write',
      'quiz_events_client_read',
      'quiz_events_merchant_author_read',
      'quiz_slots_merchant_author_write',
      'quiz_slots_client_read',
      'quiz_slots_merchant_author_read',
      'quiz_variants_merchant_author_write',
      'quiz_variants_client_read',
      'quiz_variants_merchant_author_read',
    ];

    for (const policyName of droppedPolicies) {
      expect(normalizedMigrationSql).toContain(
        `DROP POLICY IF EXISTS ${policyName}`
      );
    }

    const replacementPolicies = [
      'quiz_events_authenticated_select',
      'quiz_events_merchant_author_insert',
      'quiz_events_merchant_author_update',
      'quiz_events_merchant_author_delete',
      'quiz_slots_authenticated_select',
      'quiz_slots_merchant_author_insert',
      'quiz_slots_merchant_author_update',
      'quiz_slots_merchant_author_delete',
      'quiz_variants_authenticated_select',
      'quiz_variants_merchant_author_insert',
      'quiz_variants_merchant_author_update',
      'quiz_variants_merchant_author_delete',
    ];

    for (const policyName of replacementPolicies) {
      expect(normalizedMigrationSql).toContain(`CREATE POLICY ${policyName}`);
    }
  });
});

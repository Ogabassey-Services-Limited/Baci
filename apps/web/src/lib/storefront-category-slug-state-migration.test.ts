import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  resolve(
    __dirname,
    '../../../../supabase/migrations/20260602090000_fix_storefront_category_slug_state_missing_row.sql'
  ),
  'utf8'
);

describe('storefront category slug state migration', () => {
  it('returns active when no category row matches the slug', () => {
    expect(migrationSql).toMatch(
      /CREATE OR REPLACE FUNCTION private\.get_storefront_category_slug_state/i
    );
    expect(migrationSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.get_storefront_category_slug_state/i
    );
    expect(migrationSql).toMatch(/FROM public\.categories/i);
    expect(migrationSql).toMatch(
      /SELECT\s+COALESCE[\s\S]*true[\s\S]*AS\s+is_active/i
    );
  });
});

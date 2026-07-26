import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    import.meta.dirname,
    '../../../../supabase/migrations/20260726103000_atomic_category_hierarchy_lifecycle.sql'
  ),
  'utf8'
);

describe('category hierarchy lifecycle migration', () => {
  it('locks relevant parents and rejects invalid or cyclic hierarchy writes', () => {
    const hierarchyStart = migration.indexOf(
      'CREATE OR REPLACE FUNCTION private.enforce_category_hierarchy_before_write()'
    );
    const hierarchyEnd = migration.indexOf(
      'CREATE OR REPLACE FUNCTION private.apply_category_lifecycle_after_update()',
      hierarchyStart
    );
    expect(hierarchyStart).toBeGreaterThanOrEqual(0);
    expect(hierarchyEnd).toBeGreaterThan(hierarchyStart);
    const hierarchyFunction = migration.slice(hierarchyStart, hierarchyEnd);

    expect(hierarchyFunction).toContain('FOR UPDATE');
    expect(migration).not.toContain('LOCK TABLE');
    expect(migration).not.toContain('FOR EACH STATEMENT');
    expect(migration).not.toContain('pg_advisory_xact_lock');
    expect(migration).toContain('parent.is_active IS TRUE');
    expect(migration).toContain("MESSAGE = 'CATEGORY_PARENT_INVALID'");
    expect(migration).toContain("MESSAGE = 'CATEGORY_PARENT_CYCLE'");
    expect(migration).toContain('OLD.is_active IS DISTINCT FROM TRUE');
    expect(migration).toContain(
      'BEFORE INSERT OR UPDATE OF parent_id, is_active, slug'
    );
  });

  it('keeps rename, revival, and retirement side effects transactional', () => {
    expect(migration).toContain('ON CONFLICT (merchant_id, slug) DO NOTHING');
    expect(migration).toMatch(
      /UPDATE public\.products[\s\S]*SET category_id = NULL[\s\S]*category_id = NEW\.id[\s\S]*merchant_id = NEW\.merchant_id/
    );
    expect(migration).toContain('DELETE FROM public.product_categories');
    expect(migration).toContain('"_baci_reused_tombstone": true');
    expect(migration).toContain("- '_baci_reused_tombstone'");
    expect(migration).toContain('NEW.seo_heading := NULL');
    expect(migration).toMatch(
      /NEW\.slug IS DISTINCT FROM OLD\.slug[\s\S]*DELETE FROM public\.categories[\s\S]*slug = NEW\.slug[\s\S]*is_active IS DISTINCT FROM TRUE/
    );
    expect(migration).toMatch(
      /IF \(OLD\.is_active IS TRUE AND NEW\.is_active IS DISTINCT FROM TRUE\)[\s\S]*OR \(OLD\.is_active IS NULL AND NEW\.is_active IS FALSE\)[\s\S]*UPDATE public\.categories[\s\S]*parent_id = NULL/
    );
    expect(migration).toMatch(
      /UPDATE public\.discount_codes[\s\S]*category_ids = COALESCE\(category_ids[\s\S]*- NEW\.id::text[\s\S]*is_active = CASE[\s\S]*THEN false/
    );
    const reuseStart = migration.indexOf('"_baci_reused_tombstone": true');
    const reuseEnd = migration.indexOf(
      'NEW.metadata := COALESCE(NEW.metadata',
      reuseStart
    );
    expect(reuseStart).toBeGreaterThanOrEqual(0);
    expect(reuseEnd).toBeGreaterThan(reuseStart);
    const reuseBlock = migration.slice(reuseStart, reuseEnd);
    expect(reuseBlock).toContain('UPDATE public.categories');
    expect(reuseBlock).toContain('parent_id = NULL');
    expect(reuseBlock).toContain('UPDATE public.discount_codes');
  });

  it('preserves caller RLS instead of creating privileged callable functions', () => {
    expect(migration.match(/^SECURITY INVOKER$/gm)).toHaveLength(2);
    expect(migration).not.toContain('SECURITY DEFINER');
    expect(migration).toContain('FROM PUBLIC, anon, authenticated');
  });
});

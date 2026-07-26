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
  it('serializes hierarchy writes and rejects invalid or cyclic parents', () => {
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain('parent.is_active IS TRUE');
    expect(migration).toContain("MESSAGE = 'CATEGORY_PARENT_INVALID'");
    expect(migration).toContain("MESSAGE = 'CATEGORY_PARENT_CYCLE'");
    expect(migration).toContain('OLD.is_active IS DISTINCT FROM TRUE');
  });

  it('keeps rename, revival, and retirement side effects transactional', () => {
    expect(migration).toContain('ON CONFLICT (merchant_id, slug) DO NOTHING');
    expect(migration).toMatch(
      /UPDATE public\.products[\s\S]*SET category_id = NULL[\s\S]*category_id = NEW\.id[\s\S]*merchant_id = NEW\.merchant_id/
    );
    expect(migration).toContain('DELETE FROM public.product_categories');
    expect(migration).toContain('NEW.seo_heading := NULL');
    expect(migration).toMatch(
      /IF OLD\.is_active IS TRUE[\s\S]*UPDATE public\.categories[\s\S]*parent_id = NULL/
    );
  });

  it('preserves caller RLS instead of creating privileged callable functions', () => {
    expect(migration.match(/^SECURITY INVOKER$/gm)).toHaveLength(2);
    expect(migration).not.toContain('SECURITY DEFINER');
    expect(migration).toContain('FROM PUBLIC, anon, authenticated');
  });
});

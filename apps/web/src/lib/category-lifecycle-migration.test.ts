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
const hardeningMigration = readFileSync(
  resolve(
    import.meta.dirname,
    '../../../../supabase/migrations/20260726201000_harden_category_hierarchy_lifecycle.sql'
  ),
  'utf8'
);

describe('category hierarchy lifecycle migration', () => {
  it('serializes hierarchy reads without target-parent lock inversion', () => {
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

    const parentLookupStart = hierarchyFunction.indexOf(
      'FROM public.categories AS parent'
    );
    const parentLookupEnd = hierarchyFunction.indexOf(
      'IF NOT FOUND',
      parentLookupStart
    );
    expect(parentLookupStart).toBeGreaterThanOrEqual(0);
    expect(parentLookupEnd).toBeGreaterThan(parentLookupStart);
    const parentLookup = hierarchyFunction.slice(
      parentLookupStart,
      parentLookupEnd
    );
    expect(parentLookup).not.toMatch(/FOR\s+(?:NO\s+KEY\s+)?UPDATE/);
    expect(migration).not.toContain('LOCK TABLE');
    expect(migration).not.toContain('FOR EACH STATEMENT');
    expect(hierarchyFunction).toContain('pg_advisory_xact_lock');
    expect(hierarchyFunction).toContain(
      'hashtextextended(NEW.merchant_id::text, 0)'
    );
    expect(migration).toContain('parent.is_active IS TRUE');
    expect(migration).toContain("MESSAGE = 'CATEGORY_PARENT_INVALID'");
    expect(migration).toContain("MESSAGE = 'CATEGORY_PARENT_CYCLE'");
    expect(migration).toContain('OLD.is_active IS DISTINCT FROM TRUE');
    expect(migration).toContain(
      'BEFORE INSERT OR UPDATE OF parent_id, is_active, slug, name'
    );
  });

  it('keeps rename, revival, and retirement side effects transactional', () => {
    expect(migration).toContain('ON CONFLICT (merchant_id, slug) DO NOTHING');
    expect(migration).toMatch(
      /FOREACH v_consumed_category_id[\s\S]*UPDATE public\.products[\s\S]*category_id = NULL,[\s\S]*category = NULL[\s\S]*category_id = v_consumed_category_id[\s\S]*merchant_id = NEW\.merchant_id/
    );
    expect(migration).toMatch(
      /NEW\.name IS DISTINCT FROM OLD\.name[\s\S]*UPDATE public\.products[\s\S]*SET category = NEW\.name[\s\S]*category_id = NEW\.id[\s\S]*merchant_id = NEW\.merchant_id/
    );
    expect(migration).toContain('DELETE FROM public.product_categories');
    expect(migration).toContain('"_baci_reused_tombstone": true');
    expect(migration).toContain("- '_baci_reused_tombstone'");
    expect(migration).toContain('NEW.seo_heading := NULL');
    expect(migration).toMatch(
      /NEW\.slug IS DISTINCT FROM OLD\.slug[\s\S]*SELECT id[\s\S]*slug = NEW\.slug[\s\S]*is_active IS DISTINCT FROM TRUE/
    );
    expect(migration).toMatch(
      /IF NEW\.is_active IS FALSE THEN[\s\S]*UPDATE public\.categories[\s\S]*SET[\s\S]*parent_id = NULL[\s\S]*WHERE merchant_id = NEW\.merchant_id[\s\S]*AND parent_id = NEW\.id/
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
    expect(reuseBlock).toContain('array_append');
    expect(migration).toMatch(
      /SELECT id[\s\S]*INTO v_reused_category_id[\s\S]*slug = NEW\.slug[\s\S]*FOR UPDATE[\s\S]*array_append[\s\S]*FOREACH v_consumed_category_id[\s\S]*UPDATE public\.discount_codes[\s\S]*DELETE FROM public\.categories[\s\S]*id = v_consumed_category_id/
    );
  });

  it('preserves caller RLS instead of creating privileged callable functions', () => {
    expect(migration.match(/^SECURITY INVOKER$/gm)).toHaveLength(2);
    expect(migration).not.toContain('SECURITY DEFINER');
    expect(migration).toContain('FROM PUBLIC, anon, authenticated');
  });
});

describe('category hierarchy lifecycle hardening migration', () => {
  it('serializes retirement and rechecks both depth invariants', () => {
    expect(hardeningMigration).toContain(
      'v_hierarchy_write := NEW.is_active IS FALSE'
    );
    expect(hardeningMigration).toContain('pg_advisory_xact_lock');
    expect(hardeningMigration).toMatch(
      /parent\.is_active IS TRUE[\s\S]*parent\.parent_id IS NULL/
    );
    expect(hardeningMigration).toMatch(
      /child\.parent_id = NEW\.id[\s\S]*child\.is_active IS TRUE/
    );
    expect(hardeningMigration).toContain("MESSAGE = 'CATEGORY_DEPTH_EXCEEDED'");
    expect(hardeningMigration.match(/^SECURITY INVOKER$/gm)).toHaveLength(2);
    expect(hardeningMigration).not.toContain('SECURITY DEFINER');
  });

  it('locks retirement children before the merchant advisory lock', () => {
    const childLock = hardeningMigration.indexOf(
      'FROM public.categories AS retirement_child'
    );
    const advisoryLock = hardeningMigration.indexOf(
      'PERFORM pg_catalog.pg_advisory_xact_lock'
    );

    expect(childLock).toBeGreaterThanOrEqual(0);
    expect(advisoryLock).toBeGreaterThan(childLock);
    expect(hardeningMigration.slice(childLock, advisoryLock)).toMatch(
      /retirement_child\.parent_id = NEW\.id[\s\S]*ORDER BY retirement_child\.id[\s\S]*FOR UPDATE/
    );
  });

  it('consumes inactive reuse markers immediately', () => {
    const markerRemoval = "- '_baci_reused_tombstone'";
    const markerStart = hardeningMigration.indexOf(
      '@> \'{"_baci_reused_tombstone": true}\'::jsonb'
    );
    const markerEnd = hardeningMigration.indexOf(markerRemoval, markerStart);

    expect(markerStart).toBeGreaterThanOrEqual(0);
    expect(markerEnd).toBeGreaterThan(markerStart);
    const markerBlock = hardeningMigration.slice(
      markerStart,
      markerEnd + markerRemoval.length
    );
    expect(markerBlock).not.toContain('NEW.is_active IS TRUE');
    expect(markerBlock).toContain('array_append');
    expect(markerBlock).toContain(markerRemoval);
    expect(hardeningMigration).toMatch(
      /slug = NEW\.slug[\s\S]*is_active IS FALSE[\s\S]*FOR UPDATE/
    );
  });

  it('preserves freshness only for category-label-only product updates', () => {
    expect(hardeningMigration).toContain(
      'CREATE TRIGGER zz_preserve_product_category_label_updated_at'
    );
    expect(hardeningMigration).toMatch(
      /to_jsonb\(NEW\) - 'category' - 'updated_at'[\s\S]*to_jsonb\(OLD\) - 'category' - 'updated_at'[\s\S]*NEW\.updated_at := OLD\.updated_at/
    );
    expect(hardeningMigration).toContain('BEFORE UPDATE OF category');
    expect(hardeningMigration).toContain('updated_at = pg_catalog.now()');
  });
});

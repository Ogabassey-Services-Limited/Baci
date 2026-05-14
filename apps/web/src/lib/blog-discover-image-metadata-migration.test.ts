import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const migrationSql = readFileSync(
  resolve(
    testDir,
    '../../../../supabase/migrations/20260513173234_blog_discover_image_metadata.sql'
  ),
  'utf8'
);
const normalizedMigrationSql = migrationSql.replace(/\s+/g, ' ');

describe('blog Discover image metadata migration', () => {
  it('adds image metadata columns and the ops-controlled publish flag', () => {
    expect(migrationSql).toContain(
      'ADD COLUMN IF NOT EXISTS featured_image_width integer'
    );
    expect(migrationSql).toContain(
      'ADD COLUMN IF NOT EXISTS featured_image_height integer'
    );
    expect(migrationSql).toContain(
      "ADD COLUMN IF NOT EXISTS featured_image_variants jsonb NOT NULL DEFAULT '{}'::jsonb"
    );
    expect(migrationSql).toContain(
      'ADD COLUMN IF NOT EXISTS blog_discover_image_validation_enabled boolean NOT NULL DEFAULT false'
    );
  });

  it('backfills published_at before validating the published-row constraint', () => {
    const backfillIndex = normalizedMigrationSql.indexOf(
      "WHERE status = 'published' AND published_at IS NULL"
    );
    const validateIndex = normalizedMigrationSql.indexOf(
      'VALIDATE CONSTRAINT blog_posts_published_at_required'
    );

    expect(backfillIndex).toBeGreaterThan(-1);
    expect(validateIndex).toBeGreaterThan(backfillIndex);
    expect(normalizedMigrationSql).toMatch(
      /CHECK\s+\(status\s+<>\s+'published'\s+OR\s+published_at\s+IS\s+NOT\s+NULL\)/
    );
  });

  it('keeps the product-matching RPC aligned with published-date hygiene', () => {
    expect(migrationSql).toContain(
      'CREATE OR REPLACE FUNCTION public.match_blog_to_product'
    );
    expect(migrationSql).toContain('SECURITY INVOKER');
    expect(migrationSql).toContain("SET search_path TO 'public', 'extensions'");
    expect(migrationSql).toContain('AND bp.published_at IS NOT NULL');
  });
});

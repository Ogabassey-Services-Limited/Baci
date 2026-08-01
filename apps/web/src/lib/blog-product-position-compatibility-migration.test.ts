import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  join(
    process.cwd(),
    '../../supabase/migrations/20260801000500_preserve_legacy_blog_product_position_inserts.sql'
  ),
  'utf8'
);

describe('legacy blog product position compatibility migration', () => {
  it('assigns an ordered positive position when a direct insert omits it', () => {
    expect(migrationSql).toContain(
      'CREATE SEQUENCE IF NOT EXISTS public.blog_post_product_legacy_position_seq'
    );
    expect(migrationSql).toContain('IF NEW.position IS NOT NULL THEN');
    expect(migrationSql).toContain('pg_catalog.pg_advisory_xact_lock');
    expect(migrationSql).toContain('SELECT GREATEST');
    expect(migrationSql).toContain(
      'CREATE TRIGGER assign_legacy_blog_product_position'
    );
    expect(migrationSql).toContain(
      'BEFORE INSERT ON public.blog_post_products'
    );
    expect(migrationSql).toContain('SELECT pg_catalog.max(position)');
    expect(migrationSql).toContain('pg_catalog.setval');
    expect(migrationSql).not.toMatch(/ALTER COLUMN position SET DEFAULT/i);
  });

  it('does not widen table-write authority while allowing existing writers to use the compatibility path', () => {
    expect(migrationSql).toContain('SECURITY DEFINER');
    expect(migrationSql).toContain(
      'ALTER FUNCTION public.assign_legacy_blog_product_position() OWNER TO postgres'
    );
    expect(migrationSql).toContain(
      'REVOKE ALL ON SEQUENCE public.blog_post_product_legacy_position_seq'
    );
    expect(migrationSql).toContain(
      'FROM PUBLIC, anon, authenticated, service_role'
    );
    expect(migrationSql).not.toMatch(/GRANT .* ON SEQUENCE/i);
    expect(migrationSql).not.toMatch(
      /GRANT\s+(?:INSERT|UPDATE|DELETE|ALL).*blog_post_products/i
    );
  });
});

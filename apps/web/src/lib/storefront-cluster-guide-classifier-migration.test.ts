import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const MIGRATION_SOURCE = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    '../../../../supabase/migrations/20260823134008_optimize_storefront_cluster_guide_classifier.sql'
  ),
  'utf8'
);

describe('storefront cluster guide classifier migration', () => {
  it('fixes the slow per-post rule scan without dropping substring fallback coverage', () => {
    // Regression: the old classifier ran two LEFT JOIN LATERAL rule scans for
    // every matching post. The live 26-rule / 522-post workload made that
    // classifier the dominant part of optional PDP semantic enrichment.
    expect(MIGRATION_SOURCE).toContain(
      'explicit_exact_matches AS MATERIALIZED'
    );
    expect(MIGRATION_SOURCE).toContain(
      'explicit_exact_winners AS MATERIALIZED'
    );
    expect(MIGRATION_SOURCE).toContain(
      'explicit_fallback_matches AS MATERIALIZED'
    );
    expect(MIGRATION_SOURCE).toContain(
      'ON candidate.explicit_category = category_name.category_name'
    );
    expect(MIGRATION_SOURCE).toMatch(
      /explicit_fallback_matches[\s\S]*pg_catalog\.strpos\(/
    );
    expect(MIGRATION_SOURCE).not.toMatch(/LEFT JOIN LATERAL/);
  });

  it('keeps the bounded public projection and definer isolation intact', () => {
    expect(MIGRATION_SOURCE).toMatch(
      /RETURNS TABLE \([\s\S]*featured_image_url text,[\s\S]*reading_time_minutes integer/
    );
    expect(MIGRATION_SOURCE).toContain('SECURITY DEFINER');
    expect(MIGRATION_SOURCE).toContain("SET search_path TO ''");
    expect(MIGRATION_SOURCE).toContain('LIMIT v_effective_limit');
    expect(MIGRATION_SOURCE).toContain('settings.blog_enabled IS TRUE');
    expect(MIGRATION_SOURCE).not.toMatch(/SELECT\s+\*/i);
  });
});

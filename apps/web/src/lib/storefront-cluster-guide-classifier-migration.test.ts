import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const MIGRATION_SOURCE = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    '../../../../supabase/migrations/20260823152435_optimize_storefront_cluster_guide_classifier_rpc.sql'
  ),
  'utf8'
);
const CLASSIFIER_SOURCE = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    '../../../../supabase/migrations/20260823152433_optimize_storefront_cluster_guide_classifier_core.sql'
  ),
  'utf8'
);

describe('storefront cluster guide classifier migration', () => {
  it('keeps the classifier stages in bounded migration units', () => {
    // The behavior regression runs through the public RPC in
    // supabase/tests/storefront_cluster_guide_candidates_rpc.sql. This test
    // protects the migration decomposition and optimized plan shape.
    expect(CLASSIFIER_SOURCE.split(/\r?\n/).length).toBeLessThan(300);
    expect(MIGRATION_SOURCE.split(/\r?\n/).length).toBeLessThan(300);
    expect(CLASSIFIER_SOURCE).toContain(
      'explicit_exact_matches AS MATERIALIZED'
    );
    expect(CLASSIFIER_SOURCE).toContain(
      'explicit_exact_winners AS MATERIALIZED'
    );
    expect(CLASSIFIER_SOURCE).toContain(
      'explicit_fallback_matches AS MATERIALIZED'
    );
    expect(CLASSIFIER_SOURCE).toContain(
      'ON candidate.explicit_category = category_name.category_name'
    );
    expect(CLASSIFIER_SOURCE).toMatch(
      /explicit_fallback_matches[\s\S]*pg_catalog\.strpos\(/
    );
    expect(CLASSIFIER_SOURCE).not.toMatch(/LEFT JOIN LATERAL/);
    expect(MIGRATION_SOURCE).toContain(
      'FROM private.classify_storefront_cluster_guide_candidates_v1('
    );
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
    expect(CLASSIFIER_SOURCE).toContain('SECURITY DEFINER');
    expect(CLASSIFIER_SOURCE).toContain("SET search_path TO ''");
    expect(CLASSIFIER_SOURCE).not.toMatch(/SELECT\s+\*/i);
  });
});

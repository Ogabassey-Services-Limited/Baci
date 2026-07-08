import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const MIGRATION_SOURCE = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    '../../../../supabase/migrations/20260707211507_optimize_storefront_cached_merchant_and_variant_wrappers.sql'
  ),
  'utf8'
);

describe('resolve_storefront_cached_merchant migration', () => {
  it('raises instead of returning an empty merchant row for ambiguous active domains', () => {
    expect(MIGRATION_SOURCE).toContain('LANGUAGE plpgsql');
    expect(MIGRATION_SOURCE).toContain(
      "RAISE EXCEPTION 'ambiguous_active_storefront_domain'"
    );
    expect(MIGRATION_SOURCE).not.toContain('candidate.match_count = 1');
  });

  // Regression guard: Postgres rejects a jsonb_build_object call with more than
  // 100 arguments (50 key/value pairs). The 61 public feature-settings fields
  // must stay split across sub-objects concatenated with `||`, or the migration
  // fails to apply on a fresh replay. This counts top-level arguments in every
  // jsonb_build_object call and asserts none exceeds the limit.
  it('keeps every jsonb_build_object call within the 100-argument Postgres limit', () => {
    const calls = countJsonbBuildObjectArgs(MIGRATION_SOURCE);

    expect(calls.length).toBeGreaterThan(0);
    for (const argCount of calls) {
      expect(argCount).toBeLessThanOrEqual(100);
    }
  });
});

/**
 * Returns the top-level argument count for each `jsonb_build_object(...)` call
 * in the SQL (arguments are the comma-separated expressions at paren depth 0
 * inside the call, so nested `CASE`/function-call commas are not counted).
 */
function countJsonbBuildObjectArgs(sql: string): number[] {
  const marker = 'jsonb_build_object(';
  const counts: number[] = [];
  let searchFrom = 0;

  for (
    let index = sql.indexOf(marker, searchFrom);
    index !== -1;
    index = sql.indexOf(marker, searchFrom)
  ) {
    let depth = 1;
    let commas = 0;
    let cursor = index + marker.length;

    while (depth > 0 && cursor < sql.length) {
      const char = sql[cursor];
      if (char === '(') depth += 1;
      else if (char === ')') depth -= 1;
      else if (char === ',' && depth === 1) commas += 1;
      cursor += 1;
    }

    counts.push(commas + 1);
    searchFrom = cursor;
  }

  return counts;
}

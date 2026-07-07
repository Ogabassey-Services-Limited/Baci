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
});

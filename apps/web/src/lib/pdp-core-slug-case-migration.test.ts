import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const MIGRATION_SOURCE = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    '../../../../supabase/migrations/20260712101000_pdp_core_slug_case_insensitive.sql'
  ),
  'utf8'
);

const BASE_MIGRATION_SOURCE = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    '../../../../supabase/migrations/20260710123000_storefront_public_read_snapshots.sql'
  ),
  'utf8'
);

describe('pdp core slug case-insensitivity migration', () => {
  it('compares the stored slug lowercased in every product-slug predicate', () => {
    // Input is already lowercased once (normalized_input); the stored side
    // must match the preflight RPC contract (lower(p.slug) = input.slug from
    // 20260706200000_add_storefront_preflight_rpcs.sql).
    expect(MIGRATION_SOURCE).toContain(
      'pg_catalog.lower(product_row.slug) = input.product_identifier'
    );
    expect(MIGRATION_SOURCE).toContain(
      'pg_catalog.lower(legacy_product.slug) = input.product_identifier'
    );
    // No raw stored-slug comparison against the normalized identifier remains.
    expect(MIGRATION_SOURCE).not.toMatch(
      /(?<!lower\()product_row\.slug = input\.product_identifier/
    );
    expect(MIGRATION_SOURCE).not.toMatch(
      /(?<!lower\()legacy_product\.slug = input\.product_identifier/
    );
  });

  it('changes exactly the four slug comparisons and nothing else in the function body', () => {
    const start =
      'CREATE OR REPLACE FUNCTION private.get_storefront_pdp_core_v2(';
    const end = '$$;';
    const extract = (source: string) => {
      const from = source.indexOf(start);
      const to = source.indexOf(end, from);
      return source.slice(from, to + end.length);
    };
    const patched = extract(BASE_MIGRATION_SOURCE)
      .replaceAll(
        'product_row.slug = input.product_identifier',
        'pg_catalog.lower(product_row.slug) = input.product_identifier'
      )
      .replaceAll(
        'legacy_product.slug = input.product_identifier',
        'pg_catalog.lower(legacy_product.slug) = input.product_identifier'
      );
    expect(extract(MIGRATION_SOURCE)).toBe(patched);
  });

  it('keeps the private function service-role-only', () => {
    expect(MIGRATION_SOURCE).toMatch(
      /REVOKE ALL ON FUNCTION private\.get_storefront_pdp_core_v2\(uuid, text, uuid\)\s+FROM PUBLIC, anon, authenticated, service_role;/
    );
    expect(MIGRATION_SOURCE).toMatch(
      /GRANT EXECUTE ON FUNCTION private\.get_storefront_pdp_core_v2\(uuid, text, uuid\)\s+TO service_role;/
    );
    expect(MIGRATION_SOURCE).not.toMatch(
      /GRANT EXECUTE ON FUNCTION private\.get_storefront_pdp_core_v2[\s\S]*TO anon/
    );
  });

  it('documents the expression index that keeps the lowered lookup bounded', () => {
    expect(MIGRATION_SOURCE).toContain('idx_products_merchant_lower_slug');
  });
});

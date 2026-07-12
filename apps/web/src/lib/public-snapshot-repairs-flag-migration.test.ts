import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const MIGRATION_SOURCE = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    '../../../../supabase/migrations/20260712100000_public_snapshot_repairs_flag.sql'
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

describe('public snapshot repairs flag migration', () => {
  it('adds repairs_catalog_enabled to the anonymous wrapper feature-settings allowlist', () => {
    // The inner resolver already emits the flag
    // (20260711100010_add_repairs_catalog_enabled_to_cached_merchant_rpc.sql);
    // the wrapper's defense-in-depth allowlist was the only remaining filter.
    expect(MIGRATION_SOURCE).toContain(
      'public.resolve_storefront_public_snapshot_v2'
    );
    expect(MIGRATION_SOURCE).toMatch(
      /'privacy_page_enabled',\s*'repairs_catalog_enabled',\s*'reviews_enabled',/
    );
  });

  it('keeps the wrapper allowlist-only and preserves the locked-down grants', () => {
    // Still an allowlist projection (no raw feature_settings passthrough).
    expect(MIGRATION_SOURCE).toContain('public_feature_setting.key = ANY');
    expect(MIGRATION_SOURCE).toMatch(
      /REVOKE ALL ON FUNCTION public\.resolve_storefront_public_snapshot_v2\(text\)\s+FROM PUBLIC, anon, authenticated, service_role;/
    );
    expect(MIGRATION_SOURCE).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.resolve_storefront_public_snapshot_v2\(text\)\s+TO anon, authenticated, service_role;/
    );
    // The broad service-only resolver's grants are NOT touched by this
    // migration — it must never regain anon access here.
    expect(MIGRATION_SOURCE).not.toContain(
      'GRANT EXECUTE ON FUNCTION public.resolve_storefront_cached_merchant'
    );
  });

  it('is byte-identical to the base definition except for the added allowlist key', () => {
    const start =
      'CREATE OR REPLACE FUNCTION public.resolve_storefront_public_snapshot_v2(';
    const end = '$$;';
    const extract = (source: string) => {
      const from = source.indexOf(start);
      const to = source.indexOf(end, from);
      return source.slice(from, to + end.length);
    };
    const patched = extract(BASE_MIGRATION_SOURCE).replace(
      "'privacy_page_enabled',",
      "'privacy_page_enabled',\n              'repairs_catalog_enabled',"
    );
    expect(extract(MIGRATION_SOURCE)).toBe(patched);
  });
});

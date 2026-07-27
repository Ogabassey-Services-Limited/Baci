import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPOSITORY_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../..'
);
const CACHED_DATA_SOURCE = readFileSync(
  join(REPOSITORY_ROOT, 'apps/web/src/lib/cached-data.ts'),
  'utf8'
);
const MIGRATION_SOURCE = readFileSync(
  join(
    REPOSITORY_ROOT,
    'supabase/migrations/20260727150000_exact_product_and_feature_cache_invalidation.sql'
  ),
  'utf8'
);

describe('cache invalidation feature projection', () => {
  it('tracks every scalar selected by the public feature-settings cache', () => {
    const selectBlock = CACHED_DATA_SOURCE.match(
      /const MERCHANT_PUBLIC_FEATURE_SETTINGS_SELECT: string = `([\s\S]*?)`;?/
    )?.[1];
    expect(selectBlock).toBeDefined();

    const publicScalarColumns = selectBlock
      ?.split(',')
      .map((column) => column.trim())
      .filter((column) => column && column !== 'custom_settings');

    expect(publicScalarColumns).not.toHaveLength(0);
    for (const column of publicScalarColumns ?? []) {
      expect(MIGRATION_SOURCE).toContain(`'${column}'`);
    }
  });

  it('tracks only the custom settings published by the public snapshot', () => {
    for (const key of [
      'google_merchant_id',
      'google_store_widget_enabled',
      'paypal_enabled',
      'paypal_mode',
    ]) {
      expect(MIGRATION_SOURCE).toContain(`'${key}'`);
    }

    expect(MIGRATION_SOURCE).not.toContain("'facebook_capi_token'");
    expect(MIGRATION_SOURCE).not.toContain("'paypal_client_secret'");
  });
});

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const modulePath = resolve(
  process.cwd(),
  'src/lib/events/event-pipeline-boundary-manifest.ts'
);

describe('event pipeline authority manifest', () => {
  it('freezes every direct database projection and RPC classification', async () => {
    expect(existsSync(modulePath), 'boundary manifest is missing').toBe(true);
    if (!existsSync(modulePath)) return;

    const moduleUrl = pathToFileURL(modulePath).href;
    const { eventPipelineBoundaryManifest: manifest } = await import(
      /* @vite-ignore */ moduleUrl
    );
    expect(manifest.projections.identity).toEqual({
      domains: ['merchant_id'],
      merchant_slug_aliases: ['merchant_id'],
      merchants: ['id'],
    });
    expect(manifest.projections.paidDelivery).toEqual({
      order_items: ['id', 'product_id', 'name', 'price', 'quantity'],
      orders: [
        'id',
        'merchant_id',
        'order_number',
        'payment_status',
        'total',
        'currency',
        'customer_email',
        'customer_phone',
        'customer_name',
        'customer_id',
        'shipping_address',
        'ad_tracking',
      ],
    });
    expect(manifest.functions.typescriptApplication).toHaveLength(15);
    expect(manifest.functions.vpsCleanup).toEqual([
      'cleanup_domain_event_pipeline_v1',
    ]);
    expect(manifest.functions.sqlInternal).toEqual([
      'is_event_ingress_capability_v1',
      'replay_event_delivery_v1',
    ]);
    expect(manifest.functions.serviceRoleMetrics).toEqual([
      'get_domain_event_queue_metrics_v1',
    ]);
  });

  it('pins the six compatibility route receipts without authorizing Task 6 wrappers', async () => {
    expect(existsSync(modulePath), 'boundary manifest is missing').toBe(true);
    if (!existsSync(modulePath)) return;
    const moduleUrl = pathToFileURL(modulePath).href;
    const { eventPipelineBoundaryManifest: manifest } = await import(
      /* @vite-ignore */ moduleUrl
    );
    expect(manifest.frozenRoutes).toEqual({
      'apps/web/src/app/api/analytics/ads/route.ts':
        'b714f0bedeed7bded973fbe743c74517622ea8e0069dfca35051752dc45571dd',
      'apps/web/src/app/api/analytics/facebook-capi/route.ts':
        'f41e1de587645b8fdb2af8af180eb581b2bfeecae688670d7b5c7a80088b7c32',
      'apps/web/src/app/api/analytics/ga4/route.ts':
        '9e9b8c3edb1636d2f27e9551568d5036778fce6ab54272f1fd3b77cfd0f88c9f',
      'apps/web/src/app/api/analytics/snapchat/route.ts':
        '1a7898d59038b6a37e057e74da3907f4a42da9c25c7236e9d324d7b1516e4cd3',
      'apps/web/src/app/api/analytics/tiktok/route.ts':
        '4d59510f6a72ae25dd45c8cc8ea6762a709bf745286140a7a9e1aa4b64ee942e',
      'apps/web/src/app/api/platform/events/route.ts':
        'bb3b5ea163f7029bd8a90523ac7944c9e126b2aebc0ce673f82c4e0c48d00161',
    });
    expect(manifest.trustedWrapperImporters).toEqual([]);
  });

  it('binds the anon regression to the exact grant and JSON-key sweeps', () => {
    const sqlPath = resolve(
      process.cwd(),
      '../../supabase/migrations/tests/restore_merchants_anon_public_columns.sql'
    );
    const sql = readFileSync(sqlPath, 'utf8');
    expect(sql).toContain('expected_public_cols text[]');
    expect(sql).toContain('expected_published_merchant_keys text[]');
    expect(sql).toContain('expected_feature_setting_keys text[]');
    expect(sql).toContain('pg_get_functiondef');
    expect(sql).toContain('effective anon merchant RLS is not published-only');
    expect(sql).toContain('2026-08-24');
  });
});

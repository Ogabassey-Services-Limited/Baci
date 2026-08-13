import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from '@typescript/typescript6';
import { describe, expect, it } from 'vitest';
import { eventPipelineJumiaCredentialPaths } from '@/lib/events/event-pipeline-jumia-credential-paths';
import { authorityFindings } from './event-pipeline-boundary-manifest';

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
    expect(manifest.functions.typescriptApplication).toHaveLength(18);
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

  it('pins the six compatibility route receipts and two Task 6 wrappers', async () => {
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
    expect(manifest.trustedWrapperImporters).toEqual([
      'apps/web/src/app/api/analytics/conversion/route.ts',
      'apps/web/src/app/api/events/route.ts',
    ]);
    expect(manifest.sdkConstructorHashes).toEqual({
      'apps/web/src/lib/events/event-ingress-capability.ts':
        '5e0cf13d22315a021e6a122604563777f0ecc22a1a88faed003daa3bee0db64c',
      'apps/web/src/lib/events/event-pipeline-test-client.ts':
        '4979380981132de46400971d9a626629db654df139f17321dceef7f4d0b6e713',
    });
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
    expect(sql).toContain('FROM pg_policies');
    expect(sql).toContain('pg_get_expr');
    expect(sql).toContain('is_published IS TRUE');
    expect(sql).toContain('effective anon merchant RLS is not published-only');
    expect(sql).toContain('repairs_catalog_enabled');
    expect(sql).toContain('cardinality(expected_feature_setting_keys) <> 62');
    expect(sql).toContain('2026-08-24');
  });

  it.each([
    'apps/web/src/app/api/orders/route.ts',
    'apps/web/src/app/api/payments/juicyway/webhook/route.ts',
  ])('allows %s to import but not construct the admin client', (path) => {
    const importOnly = ts.createSourceFile(
      path,
      "import { createAdminClient } from '@/lib/supabase/admin';",
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );
    expect(authorityFindings(path, importOnly)).toEqual([]);
    const construction = ts.createSourceFile(
      path,
      "import { createAdminClient } from '@/lib/supabase/admin'; createAdminClient('event-pipeline');",
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );
    expect(authorityFindings(path, construction)).toContain(
      `${path}: privileged route client construction is forbidden`
    );
  });

  it('pins the finite privileged-factory importer sets', async () => {
    expect(existsSync(modulePath), 'boundary manifest is missing').toBe(true);
    if (!existsSync(modulePath)) return;
    const moduleUrl = pathToFileURL(modulePath).href;
    const { eventPipelineBoundaryManifest: manifest } = await import(
      /* @vite-ignore */ moduleUrl
    );

    expect(manifest.authority.adminImporters).toEqual([
      'apps/web/src/app/api/orders/route.ts',
      'apps/web/src/app/api/payments/juicyway/webhook/route.ts',
      'apps/web/src/app/api/platform/events/platform-event-forwarding.ts',
      'apps/web/src/lib/events/record-platform-order-created-event.ts',
      'apps/web/src/lib/expo-push.ts',
      'apps/web/src/lib/insurance/notify-activate-protection.ts',
    ]);
    expect(manifest.authority.serviceImporters).toEqual([
      'apps/web/src/app/api/cron/drain-cache-invalidations/route.ts',
      'apps/web/src/app/api/cron/gigl-tracking-notifications/route.ts',
      'apps/web/src/app/api/cron/gigl-tracking/route.ts',
      'apps/web/src/app/api/analytics/conversion/route.ts',
      'apps/web/src/app/api/events/route.ts',
      'apps/web/src/lib/events/event-pipeline-service-role-test-client.ts',
      'apps/web/src/scripts/process-domain-events.ts',
      'apps/web/src/scripts/process-event-deliveries.ts',
    ]);
    expect(manifest.authority.operationalServiceImporters).toEqual([
      'apps/web/src/scripts/reconcile-paystack-unmatched-partial.ts',
    ]);
    expect(manifest.authority.credentialPaths).toEqual([
      [
        'apps/web/src/app/(platform)/onboarding/actions.ts',
        'apps/web/src/app/(platform)/onboarding/submit-onboarding-workflow.ts',
        'apps/web/src/env.ts',
      ],
      [
        'apps/web/src/app/(platform)/onboarding/submit-onboarding-workflow.ts',
        'apps/web/src/env.ts',
      ],
      [
        'apps/web/src/lib/storefront-product-purge-hostnames.ts',
        'apps/web/src/lib/cloudflare-purge.ts',
        'apps/web/src/env.ts',
      ],
      [
        'apps/web/src/app/api/cron/gigl-tracking/gigl-tracking-notification-worker.ts',
        'apps/web/src/lib/expo-push.ts',
        'apps/web/src/env.ts',
      ],
      [
        'apps/web/src/app/api/cron/gigl-tracking/gigl-tracking-notification-worker.ts',
        'apps/web/src/lib/expo-push.ts',
        'apps/web/src/lib/supabase/admin.ts',
        'apps/web/src/env.ts',
      ],
      [
        'apps/web/src/app/api/cron/gigl-tracking-notifications/route.ts',
        'apps/web/src/app/api/cron/gigl-tracking/gigl-tracking-notification-worker.ts',
        'apps/web/src/lib/expo-push.ts',
        'apps/web/src/env.ts',
      ],
      [
        'apps/web/src/app/api/cron/gigl-tracking-notifications/route.ts',
        'apps/web/src/app/api/cron/gigl-tracking/gigl-tracking-notification-worker.ts',
        'apps/web/src/lib/expo-push.ts',
        'apps/web/src/lib/supabase/admin.ts',
        'apps/web/src/env.ts',
      ],
      [
        'apps/web/src/app/api/cron/gigl-tracking/gigl-tracking-notification-worker.ts',
        'apps/web/src/lib/insurance/notify-activate-protection.ts',
        'apps/web/src/lib/expo-push.ts',
        'apps/web/src/env.ts',
      ],
      [
        'apps/web/src/app/api/cron/gigl-tracking/gigl-tracking-notification-worker.ts',
        'apps/web/src/lib/insurance/notify-activate-protection.ts',
        'apps/web/src/lib/supabase/admin.ts',
        'apps/web/src/env.ts',
      ],
      [
        'apps/web/src/app/api/cron/gigl-tracking-notifications/route.ts',
        'apps/web/src/app/api/cron/gigl-tracking/gigl-tracking-notification-worker.ts',
        'apps/web/src/lib/insurance/notify-activate-protection.ts',
        'apps/web/src/lib/expo-push.ts',
        'apps/web/src/env.ts',
      ],
      [
        'apps/web/src/app/api/cron/gigl-tracking-notifications/route.ts',
        'apps/web/src/app/api/cron/gigl-tracking/gigl-tracking-notification-worker.ts',
        'apps/web/src/lib/insurance/notify-activate-protection.ts',
        'apps/web/src/lib/supabase/admin.ts',
        'apps/web/src/env.ts',
      ],
      ...eventPipelineJumiaCredentialPaths,
    ]);
  });

  it.each([
    'apps/web/src/lib/payments/file-stuck-credit-direct-review.ts',
    'apps/web/src/lib/payments/resolve-credit-direct-confirmation-review.ts',
  ])('rejects the retired admin importer %s', (path) => {
    const importOnly = ts.createSourceFile(
      path,
      "import { createAdminClient } from '@/lib/supabase/admin';",
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );

    expect(authorityFindings(path, importOnly)).toContain(
      `${path}: unauthorized admin factory importer`
    );
  });

  it('rejects the Credit Direct webhook as a service importer', () => {
    const path = 'apps/web/src/app/api/payments/credit-direct/webhook/route.ts';
    const importOnly = ts.createSourceFile(
      path,
      "import { createServiceClient } from '@/lib/supabase/service';",
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );

    expect(authorityFindings(path, importOnly)).toContain(
      `${path}: unauthorized trusted wrapper importer`
    );
  });

  it('rejects a namespace service factory in a fourth route', () => {
    const path = 'apps/web/src/app/api/fourth/route.ts';
    const source = ts.createSourceFile(
      path,
      "import * as svc from '@/lib/supabase/service'; svc.createServiceClient('event-pipeline');",
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );
    expect(authorityFindings(path, source)).toEqual(
      expect.arrayContaining([
        `${path}: unauthorized trusted wrapper importer`,
        `${path}: unauthorized service factory importer`,
        `${path}: privileged route client construction is forbidden`,
      ])
    );
  });

  it('rejects a deep Supabase SDK factory import', () => {
    const path = 'apps/web/src/app/api/fourth/route.ts';
    const source = ts.createSourceFile(
      path,
      "import { createClient } from '@supabase/supabase-js/dist/index.mjs'; createClient(url, importedKey);",
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );

    expect(authorityFindings(path, source)).toContain(
      `${path}: unauthorized privileged SDK factory importer`
    );
  });
});

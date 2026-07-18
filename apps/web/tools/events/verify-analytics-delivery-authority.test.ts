import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeCredentialProjectionSets } from './analytics-delivery-credential-projection-analysis';
import {
  analyzeChangedRuntimeContracts,
  analyzeTemporaryAuthorityExpiry,
  changedPaths,
  verifyAnalyticsDeliveryAuthority,
} from './verify-analytics-delivery-authority';

describe('analytics delivery authority verifier', () => {
  it('fails closed on the temporary authority expiry date', () => {
    expect(
      analyzeTemporaryAuthorityExpiry(new Date('2026-09-15T23:59:59.999Z'))
    ).toEqual([]);
    expect(
      analyzeTemporaryAuthorityExpiry(new Date('2026-09-16T00:00:00.000Z'))
    ).toEqual([
      'temporary event-pipeline analytics authority expired at 2026-09-16T00:00:00.000Z',
    ]);
  });

  it('requires exact credential projection sets', () => {
    const config =
      'apps/web/src/lib/analytics/fetch-analytics-platform-config.ts';
    const platform =
      'apps/web/src/app/api/platform/events/platform-event-forwarding.ts';
    const exact = new Map([
      [
        config,
        "export async function fetchAnalyticsPlatformConfig(client) { const A='plan_tier, plan_expires_at, premium_features'; const B='offline_conversions_enabled, facebook_pixel_id, facebook_capi_token, tiktok_pixel_id, tiktok_access_token, google_analytics_id, ga4_api_secret, snapchat_pixel_id, snapchat_capi_token'; const C='facebook_pixel_id, facebook_capi_token, tiktok_pixel_id, tiktok_access_token, google_analytics_id, ga4_api_secret, snapchat_pixel_id, snapchat_capi_token'; client.from('merchants').select(A); client.from('merchants').select(B); client.from('merchant_feature_settings').select(C); }",
      ],
      [
        platform,
        "import { createAdminClient } from '@/lib/supabase/admin'; createAdminClient('event-pipeline').from('platform_settings').select('google_analytics_id, ga4_api_secret, facebook_pixel_id, facebook_capi_token')",
      ],
    ]);
    expect(analyzeCredentialProjectionSets(exact)).toEqual([]);
    exact.set(
      platform,
      "import { createAdminClient } from '@/lib/supabase/admin'; createAdminClient('event-pipeline').from('platform_settings').select('google_analytics_id, ga4_api_secret, facebook_pixel_id, facebook_capi_token, secret')"
    );
    expect(analyzeCredentialProjectionSets(exact)).toEqual([
      `${platform}: exact credential projection set drift`,
    ]);
  });

  it('fails closed on an unresolved additional credential select', () => {
    const config =
      'apps/web/src/lib/analytics/fetch-analytics-platform-config.ts';
    const sources = new Map([
      [
        config,
        "const A='plan_tier, plan_expires_at, premium_features'; const B='offline_conversions_enabled, facebook_pixel_id, facebook_capi_token, tiktok_pixel_id, tiktok_access_token, google_analytics_id, ga4_api_secret, snapchat_pixel_id, snapchat_capi_token'; const C='facebook_pixel_id, facebook_capi_token, tiktok_pixel_id, tiktok_access_token, google_analytics_id, ga4_api_secret, snapchat_pixel_id, snapchat_capi_token'; client.from('merchants').select(A); client.from('merchants').select(B); client.from('merchant_feature_settings').select(C); client.from('merchant_feature_settings').select(runtimeProjection);",
      ],
    ]);
    expect(analyzeCredentialProjectionSets(sources)).toEqual([
      `${config}: exact credential projection set drift`,
    ]);
  });

  it('resolves credential projections in their lexical scope', () => {
    const config =
      'apps/web/src/lib/analytics/fetch-analytics-platform-config.ts';
    const sources = new Map([
      [
        config,
        "const FIELDS='plan_tier, plan_expires_at, premium_features'; { client.from('merchants').select(FIELDS); const FIELDS='extra_secret'; } const B='offline_conversions_enabled, facebook_pixel_id, facebook_capi_token, tiktok_pixel_id, tiktok_access_token, google_analytics_id, ga4_api_secret, snapchat_pixel_id, snapchat_capi_token'; const C='facebook_pixel_id, facebook_capi_token, tiktok_pixel_id, tiktok_access_token, google_analytics_id, ga4_api_secret, snapchat_pixel_id, snapchat_capi_token'; client.from('merchants').select(B); client.from('merchant_feature_settings').select(C);",
      ],
    ]);
    expect(analyzeCredentialProjectionSets(sources)).toEqual([
      `${config}: exact credential projection set drift`,
    ]);
  });

  it.each([
    [
      "createAdminClient('event-pipeline').from('other').select(FIELDS)",
      'wrong table',
    ],
    ["createAdminClient('event-pipeline').rpc('dump')", 'rpc'],
    [
      "createAdminClient('event-pipeline').from(table).select(FIELDS)",
      'dynamic table',
    ],
    [
      "createAdminClient('event-pipeline').from('platform_settings').delete()",
      'delete',
    ],
    ["createAdminClient('event-pipeline').auth.getUser()", 'auth'],
  ])('rejects an additional privileged %s operation', (extra) => {
    const platform =
      'apps/web/src/app/api/platform/events/platform-event-forwarding.ts';
    const sources = new Map([
      [
        platform,
        `import { createAdminClient } from '@/lib/supabase/admin'; const FIELDS='google_analytics_id, ga4_api_secret, facebook_pixel_id, facebook_capi_token'; createAdminClient('event-pipeline').from('platform_settings').select(FIELDS); ${extra};`,
      ],
    ]);
    expect(analyzeCredentialProjectionSets(sources)).toEqual([
      `${platform}: exact credential projection set drift`,
    ]);
  });

  it('rejects non-table surfaces on the injected config client', () => {
    const config =
      'apps/web/src/lib/analytics/fetch-analytics-platform-config.ts';
    const sources = new Map([
      [
        config,
        "const A='plan_tier, plan_expires_at, premium_features'; const B='offline_conversions_enabled, facebook_pixel_id, facebook_capi_token, tiktok_pixel_id, tiktok_access_token, google_analytics_id, ga4_api_secret, snapchat_pixel_id, snapchat_capi_token'; const C='facebook_pixel_id, facebook_capi_token, tiktok_pixel_id, tiktok_access_token, google_analytics_id, ga4_api_secret, snapchat_pixel_id, snapchat_capi_token'; client.from('merchants').select(A); client.from('merchants').select(B); client.from('merchant_feature_settings').select(C); client.auth.getUser();",
      ],
    ]);
    expect(analyzeCredentialProjectionSets(sources)).toEqual([
      `${config}: exact credential projection set drift`,
    ]);
  });

  it('tracks the injected config client independently of its name', () => {
    const config =
      'apps/web/src/lib/analytics/fetch-analytics-platform-config.ts';
    const sources = new Map([
      [
        config,
        "export async function fetchAnalyticsPlatformConfig(db) { const A='plan_tier, plan_expires_at, premium_features'; const B='offline_conversions_enabled, facebook_pixel_id, facebook_capi_token, tiktok_pixel_id, tiktok_access_token, google_analytics_id, ga4_api_secret, snapchat_pixel_id, snapchat_capi_token'; const C='facebook_pixel_id, facebook_capi_token, tiktok_pixel_id, tiktok_access_token, google_analytics_id, ga4_api_secret, snapchat_pixel_id, snapchat_capi_token'; db.from('merchants').select(A); db.from('merchants').select(B); db.from('merchant_feature_settings').select(C); db.auth.getUser(); }",
      ],
    ]);
    expect(analyzeCredentialProjectionSets(sources)).toEqual([
      `${config}: exact credential projection set drift`,
    ]);
  });

  it.each([
    "import { createClient } from '@supabase/supabase-js'; createClient('url', 'key').auth.getUser();",
    'const token = process.env.FACEBOOK_ACCESS_TOKEN;',
  ])('rejects alternate config authority: %s', (extra) => {
    const config =
      'apps/web/src/lib/analytics/fetch-analytics-platform-config.ts';
    const sources = new Map([
      [
        config,
        `const A='plan_tier, plan_expires_at, premium_features'; const B='offline_conversions_enabled, facebook_pixel_id, facebook_capi_token, tiktok_pixel_id, tiktok_access_token, google_analytics_id, ga4_api_secret, snapchat_pixel_id, snapchat_capi_token'; const C='facebook_pixel_id, facebook_capi_token, tiktok_pixel_id, tiktok_access_token, google_analytics_id, ga4_api_secret, snapchat_pixel_id, snapchat_capi_token'; client.from('merchants').select(A); client.from('merchants').select(B); client.from('merchant_feature_settings').select(C); ${extra}`,
      ],
    ]);
    expect(analyzeCredentialProjectionSets(sources)).toEqual([
      `${config}: exact credential projection set drift`,
    ]);
  });

  it.each([
    "import { createClient } from '@supabase/supabase-js'; createClient('url', 'key').storage.listBuckets();",
    'const token = process.env.FACEBOOK_ACCESS_TOKEN;',
  ])('rejects alternate platform authority: %s', (extra) => {
    const platform =
      'apps/web/src/app/api/platform/events/platform-event-forwarding.ts';
    const sources = new Map([
      [
        platform,
        `import { createAdminClient } from '@/lib/supabase/admin'; ${extra} const FIELDS='google_analytics_id, ga4_api_secret, facebook_pixel_id, facebook_capi_token'; createAdminClient('event-pipeline').from('platform_settings').select(FIELDS);`,
      ],
    ]);
    expect(analyzeCredentialProjectionSets(sources)).toEqual([
      `${platform}: exact credential projection set drift`,
    ]);
  });

  it.each([
    "let TABLE='merchants'; TABLE='merchant_feature_settings'; client.from(TABLE).select(A); client.from('merchants').select(B); client.from('merchant_feature_settings').select(C);",
    "let A='plan_tier, plan_expires_at, premium_features'; A='extra_secret'; client.from('merchants').select(A); client.from('merchants').select(B); client.from('merchant_feature_settings').select(C);",
  ])('rejects mutable credential authority: %s', (queries) => {
    const config =
      'apps/web/src/lib/analytics/fetch-analytics-platform-config.ts';
    const sources = new Map([
      [
        config,
        `const A='plan_tier, plan_expires_at, premium_features'; const B='offline_conversions_enabled, facebook_pixel_id, facebook_capi_token, tiktok_pixel_id, tiktok_access_token, google_analytics_id, ga4_api_secret, snapchat_pixel_id, snapchat_capi_token'; const C='facebook_pixel_id, facebook_capi_token, tiktok_pixel_id, tiktok_access_token, google_analytics_id, ga4_api_secret, snapchat_pixel_id, snapchat_capi_token'; ${queries}`,
      ],
    ]);
    expect(analyzeCredentialProjectionSets(sources)).toEqual([
      `${config}: exact credential projection set drift`,
    ]);
  });

  it.each([
    'const authority = client; authority.auth.admin.listUsers();',
    'const { auth } = client; auth.admin.listUsers();',
  ])('rejects an aliased injected config client: %s', (extra) => {
    const config =
      'apps/web/src/lib/analytics/fetch-analytics-platform-config.ts';
    const sources = new Map([
      [
        config,
        `const A='plan_tier, plan_expires_at, premium_features'; const B='offline_conversions_enabled, facebook_pixel_id, facebook_capi_token, tiktok_pixel_id, tiktok_access_token, google_analytics_id, ga4_api_secret, snapchat_pixel_id, snapchat_capi_token'; const C='facebook_pixel_id, facebook_capi_token, tiktok_pixel_id, tiktok_access_token, google_analytics_id, ga4_api_secret, snapchat_pixel_id, snapchat_capi_token'; function load(client) { client.from('merchants').select(A); client.from('merchants').select(B); client.from('merchant_feature_settings').select(C); ${extra} }`,
      ],
    ]);
    expect(analyzeCredentialProjectionSets(sources)).toEqual([
      `${config}: exact credential projection set drift`,
    ]);
  });

  it.each([
    "import * as admin from '@/lib/supabase/admin'; admin.createClient().auth.getUser();",
    "void import('@/lib/supabase/admin');",
  ])('rejects an additional platform admin edge: %s', (extra) => {
    const platform =
      'apps/web/src/app/api/platform/events/platform-event-forwarding.ts';
    const sources = new Map([
      [
        platform,
        `import { createAdminClient } from '@/lib/supabase/admin'; ${extra} const FIELDS='google_analytics_id, ga4_api_secret, facebook_pixel_id, facebook_capi_token'; createAdminClient('event-pipeline').from('platform_settings').select(FIELDS);`,
      ],
    ]);
    expect(analyzeCredentialProjectionSets(sources)).toEqual([
      `${platform}: exact credential projection set drift`,
    ]);
  });

  it('enforces changed runtime size and colocated tests', () => {
    const good = 'apps/web/src/lib/analytics/good.ts';
    const oversized = 'apps/web/src/lib/analytics/oversized-provider.ts';
    const sources = new Map([
      [good, 'export const good = true;'],
      ['apps/web/src/lib/analytics/good.test.ts', 'test();'],
      [oversized, `${'// line\n'.repeat(301)}export const send = true;`],
    ]);
    expect(analyzeChangedRuntimeContracts([good, oversized], sources)).toEqual([
      `${oversized}: changed runtime exceeds 300 lines`,
      `${oversized}: changed runtime is missing colocated test apps/web/src/lib/analytics/oversized-provider.test.ts`,
    ]);
  });

  it('counts an unterminated 301st runtime line', () => {
    const path = 'apps/web/src/lib/analytics/unterminated.ts';
    const sources = new Map([
      [path, Array.from({ length: 301 }, () => 'export {};').join('\n')],
      ['apps/web/src/lib/analytics/unterminated.test.ts', 'export {};'],
    ]);
    expect(analyzeChangedRuntimeContracts([path], sources)).toContain(
      `${path}: changed runtime exceeds 300 lines`
    );
  });

  it('fails closed when the PR merge base cannot be resolved', () => {
    expect(() =>
      changedPaths('/repo', (args) => {
        if (args[0] === 'merge-base') throw new Error('missing base');
        return '';
      })
    ).toThrow('missing base');
  });

  it('passes the live repository authority contract', () => {
    expect(
      verifyAnalyticsDeliveryAuthority(resolve(process.cwd(), '../..'))
    ).toEqual([]);
  }, 120_000);
});

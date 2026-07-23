import { describe, expect, it } from 'vitest';
import { analyzeCredentialProjectionSets } from './analytics-delivery-credential-projection-analysis';

const config = 'apps/web/src/lib/analytics/fetch-analytics-platform-config.ts';

describe('analytics delivery credential projections', () => {
  it('rejects renamed-client non-table authority', () => {
    const source =
      "export async function fetchAnalyticsPlatformConfig(db) { const A='plan_tier, plan_expires_at, premium_features'; const B='offline_conversions_enabled, facebook_pixel_id, facebook_capi_token, tiktok_pixel_id, tiktok_access_token, google_analytics_id, ga4_api_secret, snapchat_pixel_id, snapchat_capi_token'; const C='facebook_pixel_id, facebook_capi_token, tiktok_pixel_id, tiktok_access_token, google_analytics_id, ga4_api_secret, snapchat_pixel_id, snapchat_capi_token'; db.from('merchants').select(A); db.from('merchants').select(B); db.from('merchant_feature_settings').select(C); db.auth.getUser(); }";
    expect(
      analyzeCredentialProjectionSets(new Map([[config, source]]))
    ).toEqual([`${config}: exact credential projection set drift`]);
  });

  it('rejects mutable projections and credential environments', () => {
    const mutable =
      "export async function fetchAnalyticsPlatformConfig(client) { let A='plan_tier, plan_expires_at, premium_features'; A='secret'; const B='offline_conversions_enabled, facebook_pixel_id, facebook_capi_token, tiktok_pixel_id, tiktok_access_token, google_analytics_id, ga4_api_secret, snapchat_pixel_id, snapchat_capi_token'; const C='facebook_pixel_id, facebook_capi_token, tiktok_pixel_id, tiktok_access_token, google_analytics_id, ga4_api_secret, snapchat_pixel_id, snapchat_capi_token'; client.from('merchants').select(A); client.from('merchants').select(B); client.from('merchant_feature_settings').select(C); process.env.FB_TEST_EVENT_CODE; }";
    expect(
      analyzeCredentialProjectionSets(new Map([[config, mutable]]))
    ).toEqual([`${config}: exact credential projection set drift`]);
  });

  it.each([
    "import * as admin from '../supabase/admin';",
    "const moduleName = '@/lib/supabase/admin'; void import(moduleName);",
    "const admin = require('@/lib/supabase/admin.ts');",
  ])('rejects canonical alternate privileged imports: %s', (extra) => {
    const source = `export async function fetchAnalyticsPlatformConfig(client) { ${extra} const A='plan_tier, plan_expires_at, premium_features'; const B='offline_conversions_enabled, facebook_pixel_id, facebook_capi_token, tiktok_pixel_id, tiktok_access_token, google_analytics_id, ga4_api_secret, snapchat_pixel_id, snapchat_capi_token'; const C='facebook_pixel_id, facebook_capi_token, tiktok_pixel_id, tiktok_access_token, google_analytics_id, ga4_api_secret, snapchat_pixel_id, snapchat_capi_token'; client.from('merchants').select(A); client.from('merchants').select(B); client.from('merchant_feature_settings').select(C); }`;
    const sources = new Map([
      [config, source],
      ['apps/web/src/lib/supabase/admin.ts', 'export {};'],
    ]);
    expect(analyzeCredentialProjectionSets(sources)).toEqual([
      `${config}: exact credential projection set drift`,
    ]);
  });
});

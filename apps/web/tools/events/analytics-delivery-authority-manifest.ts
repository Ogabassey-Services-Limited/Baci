export const analyticsDeliveryAuthorityManifest = {
  temporaryAuthorityExpiresAt: '2026-09-16T00:00:00.000Z',
  authorityClosureHashes: {
    'apps/web/src/app/api/analytics/conversion/route.ts':
      'b7f45a04dd3d0d46cd7615f1f17de390fba80054dd618485904574ef8f04638c',
    'apps/web/src/app/api/events/route.ts':
      '18ab338cdaa66b219fd733e46796df7179a59ba9306e57e1d8faed1c2c1ddf0f',
    'apps/web/src/app/api/platform/events/platform-event-forwarding.ts':
      '39ab8803de43052e26e87de5b5a34ccb1687cf636955a94d5b1a1ba80865c75f',
    'apps/web/src/lib/analytics/fetch-analytics-platform-config.ts':
      '95cc62af2d374bfed4b9b89b5b745e2dbd4c34ada1f3a25cf0c398e3cb376c1e',
    'apps/web/src/lib/analytics/trusted-server-ad-platform-fanout.ts':
      '2f330fb4efcd9cbcbef7a524f43232572082908e4f73e27d72a8cbb8636380b5',
    'apps/web/src/lib/supabase/service.ts':
      '13e10a25092e1a53c8f091b3576e804f6e1268f55d63393d2a2231ddc46cc5bc',
  },
  callerScopedRouteHashes: {
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
  },
  credentialProjections: {
    merchantEntitlement: 'plan_tier, plan_expires_at, premium_features',
    merchantProviderConfig:
      'offline_conversions_enabled, facebook_pixel_id, facebook_capi_token, tiktok_pixel_id, tiktok_access_token, google_analytics_id, ga4_api_secret, snapchat_pixel_id, snapchat_capi_token',
    merchantFeatureProviderConfig:
      'facebook_pixel_id, facebook_capi_token, tiktok_pixel_id, tiktok_access_token, google_analytics_id, ga4_api_secret, snapchat_pixel_id, snapchat_capi_token',
    platformProviderConfig:
      'google_analytics_id, ga4_api_secret, facebook_pixel_id, facebook_capi_token',
  },
  platformAuthority: {
    helper: 'apps/web/src/app/api/platform/events/platform-event-forwarding.ts',
    route: 'apps/web/src/app/api/platform/events/route.ts',
  },
  platformRouteHash: {
    path: 'apps/web/src/app/api/platform/events/route.ts',
    sha256: 'bb3b5ea163f7029bd8a90523ac7944c9e126b2aebc0ce673f82c4e0c48d00161',
  },
  pureFanoutRoots: [
    'apps/web/src/lib/analytics/send-configured-ad-platforms.ts',
    'apps/web/src/lib/analytics/send-facebook-ad-platform-event.ts',
    'apps/web/src/lib/analytics/send-tiktok-ad-platform-event.ts',
    'apps/web/src/lib/analytics/send-snapchat-ad-platform-event.ts',
  ],
  trustedWrapper:
    'apps/web/src/lib/analytics/trusted-server-ad-platform-fanout.ts',
  trustedWrapperImporters: [
    'apps/web/src/app/api/analytics/conversion/route.ts',
    'apps/web/src/app/api/events/route.ts',
  ],
  verifiedContextHelperHashes: {
    'apps/web/src/app/api/analytics/conversion/conversion-route-merchant-context.ts':
      'fd3686f696b06eb137804956af72c35c11e4578e4580c5e992364d4bda143cef',
    'apps/web/src/app/api/events/resolve-legacy-fanout-context.ts':
      '84abded5972fbab0b42db7e5e4321ea67d89b2ebced97b9d6b46d787bfd84967',
    'apps/web/src/lib/events/event-ingress-context.ts':
      'f47e6d124467b7464fbb267c3874f9f5a35ab74b2cad5e3115da67b8df5211ea',
  },
  workerRoots: [
    'apps/web/src/scripts/process-domain-events.ts',
    'apps/web/src/scripts/process-event-deliveries.ts',
  ],
} as const;

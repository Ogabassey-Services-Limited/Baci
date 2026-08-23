export const frozenEventPipelineAuthoritySources = {
  'apps/web/src/app/(platform)/onboarding/actions.ts':
    'ad902de74546a2ab71e1847b25076a3a3d6df711d0d5ea6229796bfe9bbb94d5',
} as const;

export const eventPipelineFrozenRoutes = {
  'apps/web/src/app/api/analytics/ads/route.ts':
    'be2ef1b3e55c6c02c8fccebdcb7df6422608d83e021861991e840aafb8f30bb1',
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
  // Orders is an inherited event-pipeline entrypoint whose notification
  // dispatch changed in this feature. Keep its reviewed bytes squash-safe by
  // binding the final source to a content receipt instead of a PR-only commit.
  'apps/web/src/app/api/orders/route.ts':
    '1b4cafe04a864d50d59c2115eb2d163c44f0d052f6e81b16bc151c86df9a03e9',
} as const;

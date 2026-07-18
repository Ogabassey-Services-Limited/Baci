import { describe, expect, it } from 'vitest';
import { analyticsDeliveryAuthorityManifest as manifest } from './analytics-delivery-authority-manifest';

describe('analytics delivery authority manifest', () => {
  it('records the temporary authority expiry', () => {
    expect(manifest.temporaryAuthorityExpiresAt).toBe(
      '2026-09-16T00:00:00.000Z'
    );
  });

  it('hash-binds the reviewed temporary authority closure', () => {
    expect(manifest.authorityClosureHashes).toEqual({
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
    });
  });

  it('records exactly two trusted route importers and the platform helper edge', () => {
    expect(manifest.trustedWrapperImporters).toEqual([
      'apps/web/src/app/api/analytics/conversion/route.ts',
      'apps/web/src/app/api/events/route.ts',
    ]);
    expect(manifest.platformAuthority).toEqual({
      helper:
        'apps/web/src/app/api/platform/events/platform-event-forwarding.ts',
      route: 'apps/web/src/app/api/platform/events/route.ts',
    });
  });

  it('classifies five caller-scoped roots separately from platform settings', () => {
    expect(Object.keys(manifest.callerScopedRouteHashes)).toHaveLength(5);
    expect(manifest.platformRouteHash).toEqual({
      path: 'apps/web/src/app/api/platform/events/route.ts',
      sha256:
        'bb3b5ea163f7029bd8a90523ac7944c9e126b2aebc0ce673f82c4e0c48d00161',
    });
  });

  it('freezes the independently verified context authorities', () => {
    expect(manifest.verifiedContextHelperHashes).toEqual({
      'apps/web/src/app/api/analytics/conversion/conversion-route-merchant-context.ts':
        'fd3686f696b06eb137804956af72c35c11e4578e4580c5e992364d4bda143cef',
      'apps/web/src/app/api/events/resolve-legacy-fanout-context.ts':
        '84abded5972fbab0b42db7e5e4321ea67d89b2ebced97b9d6b46d787bfd84967',
      'apps/web/src/lib/events/event-ingress-context.ts':
        'f47e6d124467b7464fbb267c3874f9f5a35ab74b2cad5e3115da67b8df5211ea',
    });
  });
});

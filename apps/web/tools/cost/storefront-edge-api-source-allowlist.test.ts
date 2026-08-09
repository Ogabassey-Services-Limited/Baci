import { describe, expect, it } from 'vitest';
import { isStorefrontRequiredApiSourcePath } from './storefront-edge-api-source-allowlist';

describe('isStorefrontRequiredApiSourcePath', () => {
  it('admits reviewed customer storefront APIs and excludes control-plane handlers', () => {
    expect(
      isStorefrontRequiredApiSourcePath('apps/web/src/app/api/orders/route.ts')
    ).toBe(true);
    expect(
      isStorefrontRequiredApiSourcePath(
        'apps/web/src/app/api/storefront/orders/[id]/route.ts'
      )
    ).toBe(true);
    expect(
      isStorefrontRequiredApiSourcePath(
        'apps/web/src/app/api/admin/db-health/route.ts'
      )
    ).toBe(false);
    expect(
      isStorefrontRequiredApiSourcePath(
        'apps/web/src/app/api/cron/gigl-tracking/route.ts'
      )
    ).toBe(false);
  });
});

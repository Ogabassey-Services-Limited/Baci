import { describe, expect, it } from 'vitest';
import { eventPipelineCredentialPaths } from '@/lib/events/event-pipeline-credential-paths';

describe('event-pipeline credential paths', () => {
  it('terminates every credential path at the environment module', () => {
    expect(eventPipelineCredentialPaths.length).toBeGreaterThan(10);
    expect(
      eventPipelineCredentialPaths.every(
        (path) => path.at(-1) === 'apps/web/src/env.ts'
      )
    ).toBe(true);
  });

  it('records the audited compare preflight secret edges', () => {
    expect(eventPipelineCredentialPaths).toEqual(
      expect.arrayContaining([
        [
          'apps/web/src/app/api/internal/compare-page-status/[identifier]/route.ts',
          'apps/web/src/env.ts',
        ],
        [
          'apps/web/src/lib/storefront-compare-page-hard-status.ts',
          'apps/web/src/env.ts',
        ],
        [
          'apps/web/src/proxy.ts',
          'apps/web/src/lib/storefront-compare-page-hard-status.ts',
          'apps/web/src/env.ts',
        ],
      ])
    );
  });

  it('records the scoped invoice notification delivery edges', () => {
    expect(eventPipelineCredentialPaths).toEqual(
      expect.arrayContaining([
        [
          'apps/web/src/app/api/orders/route.ts',
          'apps/web/src/lib/order-notification-dispatch.ts',
          'apps/web/src/lib/expo-push.ts',
          'apps/web/src/env.ts',
        ],
        [
          'apps/web/src/lib/invoice-notifications.ts',
          'apps/web/src/lib/expo-push.ts',
          'apps/web/src/lib/supabase/admin.ts',
          'apps/web/src/env.ts',
        ],
      ])
    );
  });

  it('records only the signed catalog routes that reach the agentic secret', () => {
    const mutationRequest = 'apps/web/src/lib/agentic/mutation-request.ts';
    const requestIntegrity = 'apps/web/src/lib/agentic/request-integrity.ts';
    const environment = 'apps/web/src/env.ts';

    expect(eventPipelineCredentialPaths).toEqual(
      expect.arrayContaining(
        ['lookup', 'product', 'search'].map((route) => [
          `apps/web/src/app/api/agentic/catalog/${route}/route.ts`,
          mutationRequest,
          requestIntegrity,
          environment,
        ])
      )
    );
  });
});

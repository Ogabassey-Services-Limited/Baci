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
});

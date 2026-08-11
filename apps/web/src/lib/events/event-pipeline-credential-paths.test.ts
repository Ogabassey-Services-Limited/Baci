import { describe, expect, it } from 'vitest';
import { eventPipelineCredentialPaths } from './event-pipeline-credential-paths';

describe('event-pipeline credential paths', () => {
  it('terminates every credential path at the environment module', () => {
    expect(eventPipelineCredentialPaths.length).toBeGreaterThan(10);
    expect(
      eventPipelineCredentialPaths.every(
        (path) => path.at(-1) === 'apps/web/src/env.ts'
      )
    ).toBe(true);
  });

  it('retains the Jumia OAuth credential paths', () => {
    expect(
      eventPipelineCredentialPaths.some((path) =>
        path[0]?.includes('/marketplace/jumia/')
      )
    ).toBe(true);
  });
});

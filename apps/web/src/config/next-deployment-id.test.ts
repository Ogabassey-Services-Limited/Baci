import { describe, expect, it } from 'vitest';
import { getNextDeploymentId } from './next-deployment-id';

describe('getNextDeploymentId', () => {
  it('prefers an explicit Next deployment id', () => {
    expect(
      getNextDeploymentId({
        NEXT_DEPLOYMENT_ID: 'manual-release-123',
        VERCEL_DEPLOYMENT_ID: 'vercel-deployment',
        VERCEL_GIT_COMMIT_SHA: 'commit-sha',
      })
    ).toBe('manual-release-123');
  });

  it('uses the Vercel deployment id exposed for skew protection', () => {
    expect(
      getNextDeploymentId({
        VERCEL_DEPLOYMENT_ID: 'dpl_ABC123',
        VERCEL_GIT_COMMIT_SHA: 'commit-sha',
      })
    ).toBe('dpl_ABC123');
  });

  it('preserves safe deployment id separator characters', () => {
    expect(
      getNextDeploymentId({
        NEXT_DEPLOYMENT_ID: 'release-2026.06.23_v1.0.0:prod',
      })
    ).toBe('release-2026.06.23_v1.0.0:prod');
  });

  it('falls back to commit sha for non-Vercel prebuilt deployments', () => {
    expect(
      getNextDeploymentId({
        VERCEL_GIT_COMMIT_SHA: '73b79847609f07e0fffece5e80a3e31e0b78587a',
      })
    ).toBe('73b79847609f07e0fffece5e80a3e31e0b78587a');

    expect(
      getNextDeploymentId({
        GITHUB_SHA: 'e515baffe0b237f98ee5e2a6d0f116f04229e2af',
      })
    ).toBe('e515baffe0b237f98ee5e2a6d0f116f04229e2af');
  });

  it('ignores blank and unsafe deployment ids', () => {
    expect(
      getNextDeploymentId({
        NEXT_DEPLOYMENT_ID: '   ',
        VERCEL_DEPLOYMENT_ID: ' dpl/unsafe value ',
      })
    ).toBe('dpl-unsafe-value');
  });

  it('skips ids that only contain unsafe characters', () => {
    expect(
      getNextDeploymentId({
        NEXT_DEPLOYMENT_ID: '///',
        VERCEL_DEPLOYMENT_ID: 'fallback-dpl',
      })
    ).toBe('fallback-dpl');
  });

  it('leaves local development without a synthetic deployment id', () => {
    expect(getNextDeploymentId({})).toBeUndefined();
  });
});

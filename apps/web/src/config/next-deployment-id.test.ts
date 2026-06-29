import { describe, expect, it } from 'vitest';
import {
  applyNextDeploymentIdEnv,
  getNextDeploymentId,
} from './next-deployment-id';

describe('getNextDeploymentId', () => {
  it('prefers the neutral prebuilt deployment id source', () => {
    expect(
      getNextDeploymentId({
        BACI_NEXT_DEPLOYMENT_ID_SOURCE:
          '28113940786_2_4ed230c08d512b42aed6824b19c2427710247cbf',
        NEXT_DEPLOYMENT_ID: 'manual-release-123',
        GITHUB_SHA: 'commit-sha',
      })
    ).toBe('28113940786_2_4ed230c08d512b42ae');
  });

  it('does not use raw NEXT_DEPLOYMENT_ID as a custom id source', () => {
    expect(
      getNextDeploymentId({
        NEXT_DEPLOYMENT_ID: 'manual-release-123',
        GITHUB_SHA: 'commit-sha',
      })
    ).toBe('commit-sha');
  });

  it('ignores Vercel deployment ids because their dpl_ prefix is reserved for custom IDs', () => {
    expect(
      getNextDeploymentId({
        VERCEL_DEPLOYMENT_ID: 'dpl_ABC123',
        GITHUB_SHA: 'commit-sha',
      })
    ).toBe('commit-sha');
  });

  it('normalizes neutral source separators to Vercel custom deployment id safe characters', () => {
    expect(
      getNextDeploymentId({
        BACI_NEXT_DEPLOYMENT_ID_SOURCE: 'release-2026.06.23_v1.0.0:prod',
      })
    ).toBe('release-2026-06-23_v1-0-0-prod');
  });

  it('uses a unique workflow deployment id before commit sha fallbacks', () => {
    expect(
      getNextDeploymentId({
        BACI_NEXT_DEPLOYMENT_ID_SOURCE:
          '28113940786_2_4ed230c08d512b42aed6824b19c2427710247cbf',
        GITHUB_SHA: 'e515baffe0b237f98ee5e2a6d0f116f04229e2af',
      })
    ).toBe('28113940786_2_4ed230c08d512b42ae');
  });

  it('falls back to commit sha for non-Vercel prebuilt deployments', () => {
    expect(
      getNextDeploymentId({
        GITHUB_SHA: 'e515baffe0b237f98ee5e2a6d0f116f04229e2af',
      })
    ).toBe('e515baffe0b237f98ee5e2a6d0f116f0');
  });

  it('skips blank and unsafe deployment ids before falling back', () => {
    expect(
      getNextDeploymentId({
        BACI_NEXT_DEPLOYMENT_ID_SOURCE: '   ',
        GITHUB_SHA: 'commit-sha',
      })
    ).toBe('commit-sha');
  });

  it('rewrites the reserved Vercel deployment prefix for neutral custom IDs', () => {
    expect(
      getNextDeploymentId({
        BACI_NEXT_DEPLOYMENT_ID_SOURCE: 'dpl_manual-release',
      })
    ).toBe('baci_dpl_manual-release');
  });

  it('keeps rewritten max-length dpl-prefixed custom ids within Vercel limits', () => {
    const deploymentId = getNextDeploymentId({
      BACI_NEXT_DEPLOYMENT_ID_SOURCE: `dpl_${'a'.repeat(28)}`,
    });

    expect(deploymentId).toHaveLength(32);
    expect(deploymentId).toBe('baci_dpl_aaaaaaaaaaaaaaaaaaaaaaa');
  });

  it('skips ids that only contain unsafe characters', () => {
    expect(
      getNextDeploymentId({
        BACI_NEXT_DEPLOYMENT_ID_SOURCE: '///',
        GITHUB_SHA: 'fallback-dpl',
      })
    ).toBe('fallback-dpl');
  });

  it('returns the normalized id without mirroring it into NEXT_DEPLOYMENT_ID', () => {
    const env = {
      BACI_NEXT_DEPLOYMENT_ID_SOURCE: 'dpl_manual-release',
      NEXT_DEPLOYMENT_ID: 'dpl_raw-platform-id',
    };

    expect(applyNextDeploymentIdEnv(env)).toBe('baci_dpl_manual-release');
    expect(env).not.toHaveProperty('NEXT_DEPLOYMENT_ID');
  });

  it('clears raw NEXT_DEPLOYMENT_ID when no safe custom id is available', () => {
    const env: Record<string, string | undefined> = {
      NEXT_DEPLOYMENT_ID: 'dpl_raw-platform-id',
    };

    expect(applyNextDeploymentIdEnv(env)).toBeUndefined();
    expect(env).not.toHaveProperty('NEXT_DEPLOYMENT_ID');
  });

  it('leaves local development without a synthetic deployment id', () => {
    expect(getNextDeploymentId({})).toBeUndefined();
  });
});

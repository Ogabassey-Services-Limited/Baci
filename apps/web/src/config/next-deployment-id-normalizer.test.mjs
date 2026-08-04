import { describe, expect, it } from 'vitest';
import { normalizeNextDeploymentId } from './next-deployment-id-normalizer.mjs';

describe('normalizeNextDeploymentId', () => {
  it('normalizes the shared prebuilt and release-verification marker contract', () => {
    expect(normalizeNextDeploymentId('release-2026.06.23_v1.0.0:prod')).toBe(
      'release-2026-06-23_v1-0-0-prod'
    );
  });

  it('keeps reserved Vercel prefixes safe within the maximum length', () => {
    expect(normalizeNextDeploymentId(`dpl_${'a'.repeat(28)}`)).toBe(
      'baci_dpl_aaaaaaaaaaaaaaaaaaaaaaa'
    );
  });

  it('rejects missing and unsafe marker sources', () => {
    expect(normalizeNextDeploymentId(undefined)).toBeUndefined();
    expect(normalizeNextDeploymentId('///')).toBeUndefined();
  });
});

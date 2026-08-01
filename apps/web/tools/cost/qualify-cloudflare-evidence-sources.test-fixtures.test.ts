import { describe, expect, it } from 'vitest';
import { calculatePointerCacheCanonicalSha256 } from './qualify-cloudflare-evidence-sources';
import {
  readback,
  reviewedArtifacts,
} from './qualify-cloudflare-evidence-sources.test-fixtures';

describe('qualification test fixtures', () => {
  it('stores the canonical hash for the readback pointer cache', () => {
    const { canonicalSha256, ...pointerCacheWithoutHash } =
      readback.pointerCache;

    expect(canonicalSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(canonicalSha256).toBe(
      calculatePointerCacheCanonicalSha256(pointerCacheWithoutHash)
    );
    expect(readback.pointerCache.repeatedProbeCount).toBe(2);
    expect(readback.pointerCache.acceptedCfCacheStatuses).toEqual(['DYNAMIC']);
  });

  it('keeps reviewed artifacts aligned with both readback versions', () => {
    expect(reviewedArtifacts).toHaveLength(readback.versions.length);

    for (const [index, version] of readback.versions.entries()) {
      const artifact = reviewedArtifacts[index];
      expect(artifact).toMatchObject({
        accountId: 'account',
        scriptName: readback.scriptName,
        versionId: version.versionId,
        scriptEtag: version.scriptEtag,
        moduleSha256: version.moduleSha256,
        settingsSha256: version.settingsSha256,
        artifactReceipt: {
          canonicalSourceSha256: version.scriptEtag,
          configSha256: version.settingsSha256,
          moduleListSha256: version.moduleSha256,
          bundleSha256: version.scriptEtag,
          wranglerVersion: '4.115.0',
          soleVersionMetadataBinding: 'CF_VERSION_METADATA',
        },
      });
    }
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildQualificationArtifactVersionEndpoint,
  calculateQualificationArtifactModuleListSha256,
  canonicalizeQualificationArtifactModules,
  QualificationArtifactModuleListSchema,
  QualificationArtifactReadbackVersionSchema,
} from './cloudflare-evidence-qualification-artifact';

describe('qualification artifact module canonicalization', () => {
  it('sorts module names while retaining exact provider bytes', () => {
    const modules = [
      { name: 'src/version-b.ts', bytesBase64: 'Qg==' },
      { name: 'src/version-a.ts', bytesBase64: 'QQ==' },
    ] as const;

    expect(canonicalizeQualificationArtifactModules(modules)).toBe(
      '[{"name":"src/version-a.ts","bytesBase64":"QQ=="},{"name":"src/version-b.ts","bytesBase64":"Qg=="}]'
    );
    expect(calculateQualificationArtifactModuleListSha256(modules)).toMatch(
      /^[a-f0-9]{64}$/
    );
  });

  it('rejects duplicate names and malformed provider bytes', () => {
    expect(
      QualificationArtifactModuleListSchema.safeParse([
        { name: 'src/version-a.ts', bytesBase64: 'QQ==' },
        { name: 'src/version-a.ts', bytesBase64: 'Qg==' },
      ]).success
    ).toBe(false);
    expect(
      QualificationArtifactModuleListSchema.safeParse([
        { name: 'src/version-a.ts', bytesBase64: 'not base64' },
      ]).success
    ).toBe(false);
  });
});

describe('qualification artifact version endpoints', () => {
  const modules = [{ name: 'src/index.ts', bytesBase64: 'QQ==' }] as const;
  const version = {
    versionId: 'version-a',
    endpoint: buildQualificationArtifactVersionEndpoint(
      'account',
      'script',
      'version-a'
    ),
    scriptEtag: 'a'.repeat(64),
    moduleSha256: 'b'.repeat(64),
    modules,
    moduleListSha256: calculateQualificationArtifactModuleListSha256(modules),
    settingsSha256: 'c'.repeat(64),
  };

  it('requires a version-detail path whose final segment is versionId', () => {
    expect(
      QualificationArtifactReadbackVersionSchema.safeParse(version).success
    ).toBe(true);
    expect(
      QualificationArtifactReadbackVersionSchema.safeParse({
        ...version,
        endpoint: '/accounts/account/workers/scripts/script',
      }).success
    ).toBe(false);
    expect(
      QualificationArtifactReadbackVersionSchema.safeParse({
        ...version,
        endpoint: `${version.endpoint}/latest`,
      }).success
    ).toBe(false);
    expect(
      QualificationArtifactReadbackVersionSchema.safeParse({
        ...version,
        endpoint: buildQualificationArtifactVersionEndpoint(
          'account',
          'script',
          'version-b'
        ),
      }).success
    ).toBe(false);
  });
});

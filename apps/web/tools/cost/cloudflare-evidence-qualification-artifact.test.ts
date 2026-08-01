import { describe, expect, it } from 'vitest';
import {
  calculateQualificationArtifactModuleListSha256,
  canonicalizeQualificationArtifactModules,
  QualificationArtifactModuleListSchema,
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

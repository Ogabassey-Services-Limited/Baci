import { describe, expect, it } from 'vitest';
import {
  buildClosedEvidenceProcessEnvironment,
  parseQualificationArguments,
} from './cloudflare-evidence-qualification-cli';

describe('qualification CLI helpers', () => {
  it('requires both reviewed sidecars and the script name', () => {
    expect(
      parseQualificationArguments([
        '--validate-readback',
        '/tmp/receipt.json',
        '--expected-artifact-a',
        '/tmp/a.json',
        '--expected-artifact-b',
        '/tmp/b.json',
        '--script-name',
        'baci-evidence-qualification',
      ])
    ).toEqual({
      mode: 'validate-readback',
      receiptPath: '/tmp/receipt.json',
      expectedArtifactPaths: ['/tmp/a.json', '/tmp/b.json'],
      scriptName: 'baci-evidence-qualification',
    });
  });

  it('does not forward inherited Cloudflare credentials', () => {
    expect(() =>
      buildClosedEvidenceProcessEnvironment('CLOUDFLARE_READ_TOKEN', 'read', {
        CLOUDFLARE_WRITE_TOKEN: 'write',
      })
    ).toThrow('evidence process inherited a credential');
  });
});

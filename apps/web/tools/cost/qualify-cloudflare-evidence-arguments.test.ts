import { describe, expect, it } from 'vitest';
import { parseQualificationArguments } from './qualify-cloudflare-evidence-sources';

describe('parseQualificationArguments', () => {
  it('leaves functional prepare to its strict option parser', () => {
    expect(() => parseQualificationArguments(['--prepare'])).toThrow(
      'prepare options'
    );
    expect(() =>
      parseQualificationArguments(['--prepare', '--token', 'secret'])
    ).toThrow('prepare options');
    expect(
      parseQualificationArguments([
        '--validate-readback',
        '/private/receipt.json',
        '--expected-artifact-a',
        '/private/artifact-a.json',
        '--expected-artifact-b',
        '/private/artifact-b.json',
        '--script-name',
        'baci-evidence-qualification',
      ]).mode
    ).toBe('validate-readback');
  });
});

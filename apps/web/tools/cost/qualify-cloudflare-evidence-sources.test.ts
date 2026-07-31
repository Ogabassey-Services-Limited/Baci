import { describe, expect, it } from 'vitest';
import { parseQualificationArguments } from './qualify-cloudflare-evidence-sources';

describe('parseQualificationArguments', () => {
  it('only accepts credentialless --prepare', () => {
    expect(parseQualificationArguments(['--prepare']).mode).toBe('prepare');
    expect(() =>
      parseQualificationArguments(['--prepare', '--token', 'secret'])
    ).toThrow('credentialless');
  });
});

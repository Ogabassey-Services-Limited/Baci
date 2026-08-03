import { describe, expect, it } from 'vitest';
import { getReadTokenRevocationReadbackFactory } from './cloudflare-evidence-read-revocation-factory';

describe('getReadTokenRevocationReadbackFactory', () => {
  it.each([
    'createRevocationReadbackClient',
    'createReadTokenRevocationReadback',
    'createRevocationReadbackDependencies',
  ])('accepts the supported %s adapter export', (name) => {
    const factory = () => undefined;

    expect(getReadTokenRevocationReadbackFactory({ [name]: factory })).toBe(
      factory
    );
  });

  it('rejects a module without a supported adapter export', () => {
    expect(() => getReadTokenRevocationReadbackFactory({})).toThrow(
      'authenticated read-token revocation module is invalid'
    );
  });
});

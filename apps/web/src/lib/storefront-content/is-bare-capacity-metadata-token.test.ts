import { describe, expect, it } from 'vitest';
import { isBareCapacityMetadataToken } from './is-bare-capacity-metadata-token';

describe('isBareCapacityMetadataToken', () => {
  it('recognizes unitless storage between a model code and labeled memory', () => {
    expect(isBareCapacityMetadataToken(['x10', '128', '6gb'], 1)).toBe(true);
  });

  it('does not classify a short model number as storage metadata', () => {
    expect(isBareCapacityMetadataToken(['g3', '15', '3579'], 1)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { modelTokenMatchers } from './model-token-matchers';

describe('modelTokenMatchers', () => {
  it('recognizes dimensions without treating convertible model numbers as display sizes', () => {
    const { isConvertibleInConnector, isDimensionToken } = modelTokenMatchers;

    expect(isDimensionToken(['15', '15', 'inch'], 1)).toBe(true);
    expect(isDimensionToken(['14', 'in', '1'], 2)).toBe(false);
    expect(isConvertibleInConnector(['14', 'in', '1'], 1)).toBe(true);
  });

  it('returns false for an out-of-range dimension token', () => {
    expect(modelTokenMatchers.isDimensionToken(['model'], 4)).toBe(false);
  });
});

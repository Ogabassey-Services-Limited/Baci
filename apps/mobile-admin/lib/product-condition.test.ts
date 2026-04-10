import { describe, expect, it } from 'vitest';
import { formatProductCondition } from './product-condition';

describe('formatProductCondition', () => {
  it('formats known condition values for display', () => {
    expect(formatProductCondition('new')).toBe('New');
    expect(formatProductCondition('open_box')).toBe('Open Box');
    expect(formatProductCondition('refurbished')).toBe('Refurbished');
    expect(formatProductCondition('uk_used')).toBe('UK Used');
    expect(formatProductCondition('used')).toBe('Used');
  });

  it('formats unknown condition values without losing the value', () => {
    expect(formatProductCondition('certified_pre_owned')).toBe(
      'Certified Pre Owned'
    );
    expect(formatProductCondition('open box')).toBe('Open Box');
    expect(formatProductCondition('premium-used')).toBe('Premium Used');
  });

  it('returns null when no condition is available', () => {
    expect(formatProductCondition(null)).toBeNull();
    expect(formatProductCondition(undefined)).toBeNull();
    expect(formatProductCondition('   ')).toBeNull();
  });
});

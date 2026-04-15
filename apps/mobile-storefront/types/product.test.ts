import {
  formatProductConditionDisplay,
  formatVariantAxisLabel,
} from '@/types/product';

describe('formatProductConditionDisplay', () => {
  it('formats normalized condition keys into display labels', () => {
    expect(formatProductConditionDisplay('refurbished')).toBe('Open Box');
    expect(formatProductConditionDisplay('open_box')).toBe('Open Box');
    expect(formatProductConditionDisplay('uk_used')).toBe('Used');
    expect(formatProductConditionDisplay('new')).toBe('New');
  });

  it('formats loose condition strings into sentence case', () => {
    expect(formatProductConditionDisplay('premium used')).toBe('Premium Used');
  });

  it('handles empty and mixed-case inputs gracefully', () => {
    expect(formatProductConditionDisplay('')).toBeUndefined();
    expect(formatProductConditionDisplay(undefined)).toBeUndefined();
    expect(formatProductConditionDisplay(null)).toBeUndefined();
    expect(formatProductConditionDisplay('ReFuRbIsHeD')).toBe('Open Box');
    expect(formatProductConditionDisplay('premium-used 2')).toBe(
      'Premium Used 2'
    );
  });
});

describe('formatVariantAxisLabel', () => {
  it('formats common variant axes into readable labels', () => {
    expect(formatVariantAxisLabel('ram')).toBe('RAM');
    expect(formatVariantAxisLabel('sim_type')).toBe('SIM Type');
    expect(formatVariantAxisLabel('storage')).toBe('Storage');
  });

  it('formats unknown axes into title case', () => {
    expect(formatVariantAxisLabel('screen_size')).toBe('Screen Size');
  });

  it('handles empty and mixed-case axis values', () => {
    expect(formatVariantAxisLabel('')).toBeUndefined();
    expect(formatVariantAxisLabel(undefined)).toBeUndefined();
    expect(formatVariantAxisLabel(null)).toBeUndefined();
    expect(formatVariantAxisLabel('RAM')).toBe('RAM');
    expect(formatVariantAxisLabel('mIxEd_case_axis')).toBe('Mixed Case Axis');
  });
});

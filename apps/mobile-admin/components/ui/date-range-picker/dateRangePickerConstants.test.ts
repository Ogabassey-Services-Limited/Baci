import { describe, expect, it } from 'vitest';
import { DATE_RANGE_PICKER_WEEKDAYS } from './dateRangePickerConstants';

describe('DATE_RANGE_PICKER_WEEKDAYS', () => {
  it('defines stable IDs and labels in Sunday-to-Saturday order', () => {
    expect(DATE_RANGE_PICKER_WEEKDAYS).toEqual([
      { id: 'sunday', label: 'S' },
      { id: 'monday', label: 'M' },
      { id: 'tuesday', label: 'T' },
      { id: 'wednesday', label: 'W' },
      { id: 'thursday', label: 'T' },
      { id: 'friday', label: 'F' },
      { id: 'saturday', label: 'S' },
    ]);
  });
});

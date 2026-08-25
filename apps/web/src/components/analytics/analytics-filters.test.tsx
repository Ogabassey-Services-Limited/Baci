import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const dateRangePickerProps = vi.hoisted(() => vi.fn());
vi.mock('@/components/ui/date-range-picker', () => ({
  DateRangePicker: (props: Record<string, unknown>) => {
    dateRangePickerProps(props);
    return null;
  },
}));

import { AnalyticsFilters } from './analytics-filters';

describe('AnalyticsFilters', () => {
  it('applies the server reporting-range limit to the date picker', () => {
    render(
      <AnalyticsFilters
        date={{ from: new Date(2024, 0, 1), to: new Date(2024, 0, 31) }}
        onDateChange={vi.fn()}
      />
    );

    expect(dateRangePickerProps).toHaveBeenCalledWith(
      expect.objectContaining({ maxRangeDays: 366 })
    );
  });
});

import { format } from 'date-fns';
import { describe, expect, it } from 'vitest';
import { dateRangePickerHelpers } from '@/components/ui/date-range-picker/dateRangePickerHelpers';

describe('dateRangePickerHelpers', () => {
  it('starts a new range when there is no start date', () => {
    const day = new Date('2026-05-12T00:00:00.000Z');

    expect(
      dateRangePickerHelpers.getNextDateRangeSelection(
        { end: null, start: null },
        day
      )
    ).toEqual({
      end: null,
      start: day,
    });
  });

  it('orders the range when the second date is before the first', () => {
    const start = new Date('2026-05-14T00:00:00.000Z');
    const earlier = new Date('2026-05-12T00:00:00.000Z');

    expect(
      dateRangePickerHelpers.getNextDateRangeSelection(
        { end: null, start },
        earlier
      )
    ).toEqual({
      end: start,
      start: earlier,
    });
  });

  it('restarts the range when a completed range receives a new day', () => {
    const day = new Date('2026-05-20T00:00:00.000Z');

    expect(
      dateRangePickerHelpers.getNextDateRangeSelection(
        {
          end: new Date('2026-05-14T00:00:00.000Z'),
          start: new Date('2026-05-12T00:00:00.000Z'),
        },
        day
      )
    ).toEqual({
      end: null,
      start: day,
    });
  });

  it('builds the full calendar grid for the active month', () => {
    const days = dateRangePickerHelpers.buildCalendarDays(
      new Date('2026-05-12T00:00:00.000Z')
    );

    expect(days).toHaveLength(42);
    expect(format(days[0]!, 'MMM d')).toBe('Apr 26');
    expect(format(days.at(-1)!, 'MMM d')).toBe('Jun 6');
  });

  it('reports selected and in-range days correctly', () => {
    const selection = {
      end: new Date('2026-05-14T00:00:00.000Z'),
      start: new Date('2026-05-12T00:00:00.000Z'),
    };

    expect(
      dateRangePickerHelpers.isDateRangeDaySelected(
        new Date('2026-05-12T00:00:00.000Z'),
        selection
      )
    ).toBe(true);
    expect(
      dateRangePickerHelpers.isDateRangeDaySelected(
        new Date('2026-05-13T00:00:00.000Z'),
        selection
      )
    ).toBe(false);
    expect(
      dateRangePickerHelpers.isDateRangeDayInRange(
        new Date('2026-05-13T00:00:00.000Z'),
        selection
      )
    ).toBe(true);
  });
});

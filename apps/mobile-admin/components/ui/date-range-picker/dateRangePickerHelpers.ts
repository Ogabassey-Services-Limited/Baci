import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isBefore,
  isSameDay,
  isWithinInterval,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import type { DateRangeSelection } from '@/components/ui/date-range-picker/dateRangePickerTypes';

const buildCalendarDays = (viewDate: Date) => {
  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  return eachDayOfInterval({ start: startDate, end: endDate });
};

const getNextDateRangeSelection = (
  selection: DateRangeSelection,
  day: Date
): DateRangeSelection => {
  if (!selection.start || (selection.start && selection.end)) {
    return { start: day, end: null };
  }

  if (isBefore(day, selection.start)) {
    return { start: day, end: selection.start };
  }

  return { ...selection, end: day };
};

const isDateRangeDaySelected = (day: Date, selection: DateRangeSelection) => {
  if (!selection.start) {
    return false;
  }

  if (selection.end) {
    return isSameDay(day, selection.start) || isSameDay(day, selection.end);
  }

  return isSameDay(day, selection.start);
};

const isDateRangeDayInRange = (day: Date, selection: DateRangeSelection) => {
  if (!selection.start || !selection.end) {
    return false;
  }

  return isWithinInterval(day, {
    start: selection.start,
    end: selection.end,
  });
};

export const dateRangePickerHelpers = {
  buildCalendarDays,
  getNextDateRangeSelection,
  isDateRangeDayInRange,
  isDateRangeDaySelected,
};

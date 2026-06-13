export function formatDateRangeLabel(
  dateRange: string | { start: Date; end: Date } | null
) {
  if (typeof dateRange === 'string') return dateRange;
  if (dateRange?.start && dateRange?.end) {
    return `${formatMonthDayYear(dateRange.start)} - ${formatMonthDayYear(dateRange.end)}`;
  }
  return 'All Time';
}

function formatMonthDayYear(date: Date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

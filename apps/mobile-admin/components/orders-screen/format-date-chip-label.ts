export function formatDateChipLabel(
  dateRange: string | { start: Date; end: Date } | null
) {
  if (typeof dateRange === 'string') return dateRange;
  if (dateRange) {
    return `${formatMonthDay(dateRange.start)} - ${formatMonthDay(dateRange.end)}`;
  }
  return null;
}

function formatMonthDay(date: Date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

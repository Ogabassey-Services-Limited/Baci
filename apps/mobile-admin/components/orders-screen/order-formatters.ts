export function formatPrice(amount: number, currency = 'NGN') {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatTime(dateString: string) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  return date.toLocaleTimeString('en-NG', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getPresetDateRange(preset: string) {
  const now = new Date();
  let start = new Date(now);
  let end = new Date(now);

  switch (preset) {
    case 'Yesterday':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      end = new Date(start);
      break;
    case 'Last 7 Days':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      end = new Date(now);
      break;
    case 'Last 30 Days':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
      end = new Date(now);
      break;
    case 'This Month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
  }

  return { start, end };
}

export function formatDateRangeLabel(
  dateRange: string | { start: Date; end: Date } | null
) {
  if (typeof dateRange === 'string') return dateRange;
  if (dateRange?.start && dateRange?.end) {
    return `${formatMonthDayYear(dateRange.start)} - ${formatMonthDayYear(dateRange.end)}`;
  }
  return 'All Time';
}

export function formatDateChipLabel(
  dateRange: string | { start: Date; end: Date } | null
) {
  if (typeof dateRange === 'string') return dateRange;
  if (dateRange) {
    return `${formatMonthDay(dateRange.start)} - ${formatMonthDay(dateRange.end)}`;
  }
  return null;
}

function formatMonthDayYear(date: Date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatMonthDay(date: Date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

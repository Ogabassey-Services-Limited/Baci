export function formatPrice(amount: number, currency = 'NGN') {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatTime(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-NG', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getPresetDateRange(preset: string) {
  const now = new Date();
  let start = new Date();
  let end = new Date();

  switch (preset) {
    case 'Yesterday': {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      start = yesterday;
      end = yesterday;
      break;
    }
    case 'Last 7 Days':
      start = new Date();
      start.setDate(now.getDate() - 6);
      end = now;
      break;
    case 'Last 30 Days':
      start = new Date();
      start.setDate(now.getDate() - 29);
      end = now;
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

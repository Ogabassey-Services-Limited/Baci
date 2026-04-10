export type AnalyticsDateFilter =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'last_year'
  | 'custom';

export interface AnalyticsDateRange {
  endDate: Date;
  startDate: Date;
}

const FILTER_LABELS: Record<AnalyticsDateFilter, string> = {
  custom: 'Custom range',
  last_month: 'Last month',
  last_week: 'Last week',
  last_year: 'Last year',
  this_month: 'This month',
  this_week: 'This week',
  this_year: 'This year',
  today: 'Today',
  yesterday: 'Yesterday',
};

export function getAnalyticsFilterLabel(filter: AnalyticsDateFilter) {
  return FILTER_LABELS[filter];
}

export function resolveAnalyticsDateRange(
  filter: AnalyticsDateFilter,
  selectedYear: number,
  customStartDate: Date,
  customEndDate: Date,
  now = new Date()
): AnalyticsDateRange {
  const anchor = new Date(now);
  let startDate = new Date(anchor);
  let endDate = new Date(anchor);

  switch (filter) {
    case 'today':
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'yesterday':
      startDate.setDate(startDate.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'this_week':
      startDate.setDate(startDate.getDate() - startDate.getDay());
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'last_week':
      endDate.setDate(endDate.getDate() - endDate.getDay());
      endDate.setMilliseconds(-1);
      startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'this_month':
      startDate = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'last_month':
      startDate = new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1);
      endDate = new Date(anchor.getFullYear(), anchor.getMonth(), 0, 23, 59, 59, 999);
      break;
    case 'this_year':
      startDate = new Date(selectedYear, 0, 1);
      endDate = new Date(selectedYear, 11, 31, 23, 59, 59, 999);
      break;
    case 'last_year':
      startDate = new Date(selectedYear - 1, 0, 1);
      endDate = new Date(selectedYear - 1, 11, 31, 23, 59, 59, 999);
      break;
    case 'custom':
      startDate = new Date(customStartDate);
      endDate = new Date(customEndDate);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
  }

  return { endDate, startDate };
}

export function getPreviousAnalyticsDateRange(range: AnalyticsDateRange): AnalyticsDateRange {
  const duration = range.endDate.getTime() - range.startDate.getTime() + 1;
  const endDate = new Date(range.startDate.getTime() - 1);
  const startDate = new Date(endDate.getTime() - duration + 1);
  return { endDate, startDate };
}

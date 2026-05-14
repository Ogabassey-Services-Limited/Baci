import type { MetricType } from './useAnalyticsDetail.types';

export const METRIC_CONFIG: Record<
  MetricType,
  {
    title: string;
    columns: {
      key: string;
      label: string;
      format: 'currency' | 'number' | 'percent';
    }[];
  }
> = {
  revenue: {
    title: 'Revenue',
    columns: [
      { key: 'value', label: 'Revenue', format: 'currency' },
      { key: 'count', label: 'Sales', format: 'number' },
      { key: 'secondaryValue', label: 'Profits', format: 'currency' },
    ],
  },
  sales: {
    title: 'Sales',
    columns: [{ key: 'value', label: 'Orders', format: 'number' }],
  },
  aov: {
    title: 'Average Order Value',
    columns: [
      { key: 'value', label: 'AOV', format: 'currency' },
      { key: 'count', label: 'Orders', format: 'number' },
    ],
  },
  profits: {
    title: 'Profits',
    columns: [
      { key: 'secondaryValue', label: 'Revenue', format: 'currency' },
      { key: 'value', label: 'Profits', format: 'currency' },
    ],
  },
  vat: {
    title: 'VAT Due',
    columns: [{ key: 'value', label: 'VAT', format: 'currency' }],
  },
};

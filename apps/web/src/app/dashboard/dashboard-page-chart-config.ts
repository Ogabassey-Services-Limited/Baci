import type { ChartConfig } from '@/components/ui/chart';

export const dashboardChartConfig = {
  revenue: {
    label: 'Revenue',
    color: 'hsl(var(--primary))',
  },
  profit: {
    label: 'Profit',
    color: 'hsl(142 76% 36%)',
  },
  orders: {
    label: 'Orders',
    color: 'hsl(var(--accent))',
  },
} satisfies ChartConfig;

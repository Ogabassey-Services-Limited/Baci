import { describe, expect, it } from 'vitest';
import { dashboardChartConfig } from './dashboard-page-chart-config';

describe('dashboardChartConfig', () => {
  it('provides labeled color tokens for every dashboard series', () => {
    expect(dashboardChartConfig).toEqual({
      revenue: { label: 'Revenue', color: 'hsl(var(--primary))' },
      profit: { label: 'Profit', color: 'hsl(142 76% 36%)' },
      orders: { label: 'Orders', color: 'hsl(var(--accent))' },
    });
  });
});

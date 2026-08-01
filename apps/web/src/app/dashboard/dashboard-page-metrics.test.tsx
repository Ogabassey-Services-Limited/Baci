import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DashboardMetrics, MonthlyChartData } from './actions';
import { DashboardPageMetrics } from './dashboard-page-metrics';

vi.mock('next/dynamic', () => ({
  default: () => () => <div data-testid="revenue-sparkline" />,
}));

const dashboardData: DashboardMetrics = {
  activeNow: { change: 0, value: 0 },
  aov: 5000,
  customers: { change: 5, value: 1005 },
  fulfillmentRate: 83,
  orders: { change: 8, value: 1200 },
  revenue: { change: 10, value: 25000 },
};

const monthlyChartData: MonthlyChartData[] = [
  { month: 'June', orders: 4, profit: 15000, revenue: 20000 },
  { month: 'July', orders: 6, profit: 20000, revenue: 25000 },
];

describe('DashboardPageMetrics', () => {
  it('shows paid totals, fulfillment progress, and revenue bar titles', () => {
    render(
      <DashboardPageMetrics
        country="Nigeria"
        dashboardData={dashboardData}
        monthlyChartData={monthlyChartData}
      />
    );

    expect(screen.getByText('30-Day Paid Revenue')).toBeInTheDocument();
    expect(screen.getByText('1,200')).toBeInTheDocument();
    expect(screen.getByText('83% fulfilled')).toBeInTheDocument();
    expect(screen.getByText('+1k')).toBeInTheDocument();
    expect(screen.getByTitle(/June:/)).toBeInTheDocument();
    expect(screen.getByTitle(/July:/)).toBeInTheDocument();
  });
});

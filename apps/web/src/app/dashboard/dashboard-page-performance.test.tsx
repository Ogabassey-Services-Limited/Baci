import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MonthlyChartData, RecentSale } from './actions';
import { DashboardPagePerformance } from './dashboard-page-performance';

vi.mock('next/dynamic', () => ({
  default: () => () => <div data-testid="revenue-bar-chart" />,
}));

const monthlyChartData: MonthlyChartData[] = [
  { month: 'July', orders: 4, profit: 1500, revenue: 2500 },
];

const recentSales: RecentSale[] = [
  {
    amount: 1500,
    email: 'customer@example.com',
    id: 'sale-1',
    name: 'Ada Lovelace',
    status: 'Completed',
  },
];

describe('DashboardPagePerformance', () => {
  it('shows a recent sale beside the revenue overview', () => {
    render(
      <DashboardPagePerformance
        country="Nigeria"
        monthlyChartData={monthlyChartData}
        recentSales={recentSales}
      />
    );

    expect(screen.getByText('Revenue Overview')).toBeInTheDocument();
    expect(screen.getByText('Recent Sales')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('customer@example.com')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /View All Transactions/i })
    ).toBeInTheDocument();
  });
});

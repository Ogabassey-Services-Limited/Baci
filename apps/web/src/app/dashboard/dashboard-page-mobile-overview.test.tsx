import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DashboardMetrics } from './actions';
import { DashboardPageMobileOverview } from './dashboard-page-mobile-overview';

const dashboardData: DashboardMetrics = {
  activeNow: { change: 0, value: 14 },
  aov: 2500,
  customers: { change: 0, value: 8 },
  fulfillmentRate: 0,
  orders: { change: 0, value: 7 },
  revenue: { change: 0, value: 0 },
};

describe('DashboardPageMobileOverview', () => {
  it('shows the mobile metrics and links merchants to each quick action', () => {
    render(
      <DashboardPageMobileOverview
        country="Nigeria"
        dashboardData={dashboardData}
      />
    );

    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('14')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Add Product/i })).toHaveAttribute(
      'href',
      '/dashboard/products/new'
    );
    expect(screen.getByRole('link', { name: /View Orders/i })).toHaveAttribute(
      'href',
      '/dashboard/orders'
    );
    expect(screen.getByRole('link', { name: /Customers/i })).toHaveAttribute(
      'href',
      '/dashboard/customers'
    );
    expect(screen.getByRole('link', { name: /Insights/i })).toHaveAttribute(
      'href',
      '/dashboard/analytics'
    );
  });
});

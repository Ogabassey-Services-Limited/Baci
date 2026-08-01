import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DashboardMetrics } from './actions';
import { DashboardPageInsights } from './dashboard-page-insights';

const dashboardData: DashboardMetrics = {
  activeNow: { change: 0, value: 0 },
  aov: 0,
  customers: { change: 0, value: 0 },
  fulfillmentRate: 0,
  orders: { change: 0, value: 0 },
  revenue: { change: 12, value: 0 },
};

describe('DashboardPageInsights', () => {
  it('does not expose insight messaging before the store is published', () => {
    const { container } = render(
      <DashboardPageInsights
        businessName="Baci Shop"
        dashboardData={dashboardData}
        isPublished={false}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('celebrates a published store revenue increase using its slug', () => {
    render(
      <DashboardPageInsights
        businessName="Baci Shop"
        dashboardData={dashboardData}
        isPublished
        slug="baci-shop"
      />
    );

    expect(
      screen.getByRole('heading', { name: /Good morning, baci-shop!/i })
    ).toBeInTheDocument();
    expect(screen.getAllByText('+12%')).toHaveLength(2);
  });
});

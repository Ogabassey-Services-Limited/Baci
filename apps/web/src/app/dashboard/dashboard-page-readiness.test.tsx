import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DashboardPageReadiness } from './dashboard-page-readiness';

vi.mock('@/components/dashboard/setup-checklist', () => ({
  SetupChecklist: ({ merchantId }: { merchantId: string }) => (
    <div>Checklist for {merchantId}</div>
  ),
}));

vi.mock('@/components/dashboard/store-build-status-card', () => ({
  StoreBuildStatusCard: ({ merchantId }: { merchantId: string }) => (
    <div>Build status for {merchantId}</div>
  ),
}));

describe('DashboardPageReadiness', () => {
  it('does not render merchant readiness without a merchant identifier', () => {
    const { container } = render(<DashboardPageReadiness />);

    expect(container).toBeEmptyDOMElement();
  });

  it('binds both readiness surfaces to the current merchant', () => {
    render(<DashboardPageReadiness merchantId="merchant-1" />);

    expect(screen.getByText('Build status for merchant-1')).toBeInTheDocument();
    expect(screen.getByText('Checklist for merchant-1')).toBeInTheDocument();
  });
});

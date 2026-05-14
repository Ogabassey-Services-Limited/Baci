import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./actions', () => ({
  getDashboardMetrics: vi.fn().mockResolvedValue(null),
  getMonthlyChartData: vi.fn().mockResolvedValue([]),
  getRecentSales: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchant: () => ({
    merchant: { id: 'm1', name: 'Test Store' },
    isLoading: false,
  }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/components/dashboard/setup-checklist', () => ({
  SetupChecklist: () => <div>Checklist</div>,
}));
vi.mock('@/components/dashboard/store-build-status-card', () => ({
  StoreBuildStatusCard: () => <div>BuildStatus</div>,
}));
vi.mock('next/dynamic', () => ({ default: () => () => <div>Chart</div> }));

import DashboardClientPage from './client-page';

describe('DashboardClientPage', () => {
  it('renders without crashing', () => {
    const { container } = render(<DashboardClientPage />);
    expect(container).toBeTruthy();
  });
});

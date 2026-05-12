import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));
vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchant: vi.fn(() => ({
    merchant: { id: 'm-1', slug: 'test' },
    loading: false,
  })),
}));
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));
vi.mock('@/lib/analytics-export', () => ({
  exportAnalyticsAsCSV: vi.fn(),
  exportAnalyticsAsPDF: vi.fn(),
}));
vi.mock('@/components/analytics/analytics-category-nav', () => ({
  AnalyticsCategoryNav: () => null,
  VALID_CATEGORIES: ['overview'],
}));
vi.mock('@/components/analytics/analytics-filters', () => ({
  AnalyticsFilters: () => null,
}));
vi.mock('@/components/analytics/draggable-analytics-grid', () => ({
  DraggableAnalyticsGrid: () => null,
}));
vi.mock('@/components/ui/bag-loader', () => ({
  BagLoader: () => <div>Loading...</div>,
}));

import AnalyticsClientPage from './client-page';

describe('AnalyticsClientPage', () => {
  it('renders without crashing', () => {
    const { container } = render(<AnalyticsClientPage />);
    expect(container).toBeDefined();
  });
});

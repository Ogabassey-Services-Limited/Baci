import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mockUseSearchParams = vi.hoisted(() =>
  vi.fn(() => new URLSearchParams())
);
const mockGridProps = vi.hoisted(() => ({
  categoryError: null as string | null,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: mockUseSearchParams,
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
  VALID_CATEGORIES: [
    'overview',
    'finance',
    'products',
    'customers',
    'marketing',
    'inventory',
    'segments',
    'ads',
  ],
}));
vi.mock('@/components/analytics/analytics-filters', () => ({
  AnalyticsFilters: () => null,
}));
vi.mock('@/components/analytics/draggable-analytics-grid', () => ({
  DraggableAnalyticsGrid: (props: { categoryError?: string | null }) => {
    mockGridProps.categoryError = props.categoryError ?? null;
    return null;
  },
}));
vi.mock('@/components/ui/bag-loader', () => ({
  BagLoader: () => <div>Loading...</div>,
}));

import AnalyticsClientPage from './client-page';

describe('AnalyticsClientPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockUseSearchParams.mockReturnValue(new URLSearchParams());
    mockGridProps.categoryError = null;
  });

  it('renders without crashing', () => {
    const { container } = render(<AnalyticsClientPage />);
    expect(container).toBeDefined();
  });

  it('loads inventory analytics for the selected merchant and date range', async () => {
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams('category=inventory')
    );
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('/api/analytics?')) {
          return new Response(JSON.stringify({}), { status: 200 });
        }
        if (url.includes('/api/inventory/alerts?')) {
          return new Response(
            JSON.stringify({
              alerts: [
                {
                  alert_type: 'low_stock',
                  current_stock: 2,
                  id: 'alert-1',
                  products: { name: 'Phone' },
                  status: 'active',
                },
              ],
            }),
            { status: 200 }
          );
        }
        if (url.includes('/api/inventory/forecast?')) {
          return new Response(
            JSON.stringify({
              forecasts: [
                {
                  avgDailySales: 1,
                  currentStock: 2,
                  daysOfStock: 2,
                  productId: 'product-1',
                  productName: 'Phone',
                  salesTrend: 'increasing',
                },
              ],
              summary: { critical: 1, outOfStock: 0, warning: 0 },
            }),
            { status: 200 }
          );
        }
        throw new Error(`Unexpected request: ${url}`);
      });

    render(<AnalyticsClientPage />);

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes('/api/inventory/alerts?')
        )
      ).toBe(true);
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes('/api/inventory/forecast?')
        )
      ).toBe(true);
    });

    const baseRequest = fetchMock.mock.calls.find(([input]) =>
      String(input).includes('/api/analytics?')
    );
    expect(baseRequest?.[1]).toEqual(
      expect.objectContaining({
        headers: { 'x-baci-merchant-id': 'm-1' },
      })
    );

    const inventoryRequest = fetchMock.mock.calls.find(([input]) =>
      String(input).includes('/api/inventory/alerts?')
    );
    expect(inventoryRequest?.[1]).toEqual(
      expect.objectContaining({
        headers: { 'x-baci-merchant-id': 'm-1' },
      })
    );
  });

  it('uses the OAuth callback cache-bust token for the first ads request', async () => {
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams('category=ads&cacheBust=1724572800')
    );
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));

    render(<AnalyticsClientPage />);

    await waitFor(() => {
      const adsRequest = fetchMock.mock.calls.find(([input]) =>
        String(input).includes('/api/analytics/ads?')
      );
      expect(String(adsRequest?.[0])).toContain('cacheBust=1724572800');
    });
  });

  it('surfaces specialized analytics failures instead of rendering empty metrics', async () => {
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams('category=inventory')
    );
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/analytics?')) {
        return new Response(JSON.stringify({}), { status: 200 });
      }
      return new Response(JSON.stringify({ error: 'unavailable' }), {
        status: 503,
      });
    });

    render(<AnalyticsClientPage />);

    await waitFor(() => {
      expect(mockGridProps.categoryError).toBe(
        'Unable to load inventory analytics. Please try again.'
      );
    });
  });
});

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMerchant } from '@/hooks/useMerchant';
import { useInventoryStats } from '@/hooks/useProducts';
import { useWebsiteAnalytics } from '@/hooks/useWebsiteAnalytics';
import { ProductsStatCards } from './ProductsStatCards';

vi.mock('@/hooks/useWebsiteAnalytics', () => ({
  useWebsiteAnalytics: vi.fn(),
}));
vi.mock('@/hooks/useProducts', () => ({
  useInventoryStats: vi.fn(),
}));
vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: vi.fn(() => ({ merchant: { payout_currency: 'NGN' } })),
}));

describe('ProductsStatCards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMerchant).mockReturnValue({
      merchant: { payout_currency: 'NGN' },
    } as unknown as ReturnType<typeof useMerchant>);
    vi.mocked(useWebsiteAnalytics).mockReturnValue({
      data: null,
      isLoading: false,
    } as unknown as ReturnType<typeof useWebsiteAnalytics>);
    vi.mocked(useInventoryStats).mockReturnValue({
      data: null,
      isLoading: false,
    } as unknown as ReturnType<typeof useInventoryStats>);
  });

  it('renders items metrics when activeTab is on_website', () => {
    vi.mocked(useWebsiteAnalytics).mockReturnValue({
      data: {
        summary: {
          bestSeller: { name: 'Phone XYZ', units_sold: 50 },
          mostSearched: { query: 'iphone', count: 100 },
          topConverting: { name: 'Airpods', conversionRate: 15.5 },
        },
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useWebsiteAnalytics>);

    render(<ProductsStatCards activeTab="on_website" />);

    screen.getByText('Best Seller');
    screen.getByText('Phone XYZ');
    screen.getByText('Most Searched');
    screen.getByText('iphone');
    screen.getByText('Top Converting');
    screen.getByText('Airpods');
  });

  it('renders stock metrics when activeTab is in_stock', () => {
    vi.mocked(useInventoryStats).mockReturnValue({
      data: {
        inventoryValue: 50000,
        inventoryCost: 30000,
        totalStock: 100,
        lowStockCount: 5,
        outOfStockCount: 2,
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useInventoryStats>);

    render(<ProductsStatCards activeTab="in_stock" />);

    screen.getByText('Total Value');
    screen.getByText('₦50k');
    screen.getByText('Stock Cost');
    screen.getByText('₦30k');
    screen.getByText('Low Stock');
    screen.getByText('5');
    screen.getByText('Out of Stock');
    screen.getByText('2');
  });

  it('keeps inventory metrics in a single bounded horizontal strip', () => {
    vi.mocked(useInventoryStats).mockReturnValue({
      data: {
        inventoryValue: 50000,
        inventoryCost: 30000,
        totalStock: 100,
        lowStockCount: 5,
        outOfStockCount: 2,
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useInventoryStats>);

    render(<ProductsStatCards activeTab="in_stock" />);

    expect(screen.getByTestId('inventory-stat-card-strip')).toHaveStyle({
      flexGrow: '0',
      maxHeight: '84px',
    });
  });

  it('shows loading indicators for both metric sources', () => {
    vi.mocked(useWebsiteAnalytics).mockReturnValue({
      data: null,
      isLoading: true,
    } as unknown as ReturnType<typeof useWebsiteAnalytics>);
    vi.mocked(useInventoryStats).mockReturnValue({
      data: null,
      isLoading: true,
    } as unknown as ReturnType<typeof useInventoryStats>);

    const { rerender } = render(<ProductsStatCards activeTab="on_website" />);
    screen.getByLabelText('Loading product stats');

    rerender(<ProductsStatCards activeTab="in_stock" />);
    screen.getByLabelText('Loading product stats');
  });

  it('handles missing analytics data gracefully', () => {
    render(<ProductsStatCards activeTab="on_website" />);

    screen.getByText('Best Seller');
    screen.getByText('Most Searched');
    screen.getByText('Top Converting');
    expect(screen.getAllByText('-')).toHaveLength(3);
  });

  it('renders zero inventory amounts explicitly', () => {
    vi.mocked(useInventoryStats).mockReturnValue({
      data: {
        inventoryValue: 0,
        inventoryCost: 0,
        totalStock: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useInventoryStats>);

    render(<ProductsStatCards activeTab="in_stock" />);

    screen.getByText('Total Value');
    screen.getByText('Stock Cost');
    screen.getByText('Low Stock');
    screen.getByText('Out of Stock');
    expect(screen.getAllByText('₦0')).toHaveLength(2);
    expect(screen.getAllByText('0')).toHaveLength(2);
  });

  it('renders an analytics error state for website stats failures', () => {
    vi.mocked(useWebsiteAnalytics).mockReturnValue({
      data: null,
      error: new Error('analytics unavailable'),
      isLoading: false,
    } as unknown as ReturnType<typeof useWebsiteAnalytics>);

    render(<ProductsStatCards activeTab="on_website" />);

    screen.getByText('Website Stats');
    screen.getByText('Unavailable');
    screen.getByText('Try again later');
  });

  it('renders an inventory error state for inventory stats failures', () => {
    vi.mocked(useInventoryStats).mockReturnValue({
      data: null,
      error: new Error('inventory unavailable'),
      isLoading: false,
    } as unknown as ReturnType<typeof useInventoryStats>);

    render(<ProductsStatCards activeTab="in_stock" />);

    screen.getByText('Inventory Stats');
    screen.getByText('Unavailable');
    screen.getByText('Try again later');
  });

  it('uses the merchant currency symbol for inventory amounts', () => {
    vi.mocked(useMerchant).mockReturnValue({
      merchant: { payout_currency: 'GBP' },
    } as unknown as ReturnType<typeof useMerchant>);
    vi.mocked(useInventoryStats).mockReturnValue({
      data: {
        inventoryValue: 50000,
        inventoryCost: 30000,
        lowStockCount: 5,
        outOfStockCount: 2,
        totalStock: 100,
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useInventoryStats>);

    render(<ProductsStatCards activeTab="in_stock" />);

    screen.getByText('£50k');
    screen.getByText('£30k');
  });

  it('does not fetch inventory stats while the website stats tab is active', () => {
    render(<ProductsStatCards activeTab="on_website" />);

    expect(useWebsiteAnalytics).toHaveBeenCalledTimes(1);
    expect(useInventoryStats).not.toHaveBeenCalled();
  });

  it('does not fetch website analytics while the inventory tab is active', () => {
    render(<ProductsStatCards activeTab="in_stock" />);

    expect(useInventoryStats).toHaveBeenCalledTimes(1);
    expect(useWebsiteAnalytics).not.toHaveBeenCalled();
  });
});

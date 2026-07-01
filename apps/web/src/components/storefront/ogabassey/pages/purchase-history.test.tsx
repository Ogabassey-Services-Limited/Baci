import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OgabasseyV2PurchaseHistory } from './purchase-history';

const mockFormatCurrency = vi.hoisted(() =>
  vi.fn((amount: number) => `USD ${amount}`)
);

vi.mock('@/hooks/use-currency', () => ({
  useCurrency: () => ({
    formatCurrency: mockFormatCurrency,
  }),
}));

describe('OgabasseyV2PurchaseHistory', () => {
  beforeEach(() => {
    mockFormatCurrency.mockClear();
  });

  it("formats item prices with each order's stored currency", () => {
    render(
      <OgabasseyV2PurchaseHistory
        orders={[
          {
            created_at: '2026-07-01T00:00:00.000Z',
            currency: 'USD',
            id: 'order-1',
            items: [
              {
                id: 'item-1',
                name: 'iPhone 16 Pro',
                price: 4500,
                quantity: 2,
              },
            ],
            order_number: 'BAC-1001',
            total: 9000,
          },
        ]}
      />
    );

    expect(mockFormatCurrency).not.toHaveBeenCalled();
    expect(screen.getByText(/\$4,500\.00/)).toBeInTheDocument();
  });

  it('falls back to the storefront currency hook when order currency is absent', () => {
    render(
      <OgabasseyV2PurchaseHistory
        orders={[
          {
            created_at: '2026-07-01T00:00:00.000Z',
            id: 'order-1',
            items: [
              {
                id: 'item-1',
                name: 'iPhone 16 Pro',
                price: 4500,
                quantity: 2,
              },
            ],
            order_number: 'BAC-1001',
            total: 9000,
          },
        ]}
      />
    );

    expect(mockFormatCurrency).toHaveBeenCalledWith(4500);
    expect(screen.getByText(/USD 4500/)).toBeInTheDocument();
  });
});

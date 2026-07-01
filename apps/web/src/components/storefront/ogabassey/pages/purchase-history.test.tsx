import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
  it('formats item prices through the storefront currency hook', () => {
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

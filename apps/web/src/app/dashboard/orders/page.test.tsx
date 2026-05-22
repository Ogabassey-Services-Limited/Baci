import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getMerchantForUser: vi.fn(),
  getOrders: vi.fn(),
  getOrderStats: vi.fn(),
}));

vi.mock('@/lib/merchant-server', () => ({
  getMerchantForUser: (...args: unknown[]) => mocks.getMerchantForUser(...args),
}));

vi.mock('./actions', () => ({
  getOrderStats: (...args: unknown[]) => mocks.getOrderStats(...args),
  getOrders: (...args: unknown[]) => mocks.getOrders(...args),
}));

vi.mock('./client-page', () => ({
  default: ({
    initialOrders,
    initialOrdersError,
  }: {
    initialOrders?: Array<{ orderNumber: string }>;
    initialOrdersError?: string | null;
  }) => (
    <div role="status">
      orders:{initialOrders?.length ?? 0}
      {initialOrdersError ? ` error:${initialOrdersError}` : ''}
    </div>
  ),
}));

import OrdersPage from './page';

describe('OrdersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getMerchantForUser.mockResolvedValue({
      merchant: { id: 'merchant-1' },
    });
    mocks.getOrders.mockResolvedValue([]);
    mocks.getOrderStats.mockResolvedValue({
      completedOrders: 0,
      totalOrders: 0,
      unpaidOrders: 0,
      urgentOrders: 0,
    });
  });

  it('passes the agentic source filter into the initial orders query', async () => {
    render(
      await OrdersPage({
        searchParams: Promise.resolve({ source: 'agentic' }),
      })
    );

    expect(mocks.getOrders).toHaveBeenCalledWith('merchant-1', {
      source: 'agentic',
    });
    expect(screen.getByRole('status')).toHaveTextContent('orders:0');
  });

  it('keeps the default orders query unfiltered without source=agentic', async () => {
    render(await OrdersPage());

    expect(mocks.getOrders).toHaveBeenCalledWith('merchant-1');
    expect(mocks.getOrders).toHaveBeenCalledTimes(1);
  });

  it('passes an initial orders error to the client when the orders query rejects', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mocks.getOrders.mockRejectedValueOnce(new Error('fetch failed'));

    try {
      render(await OrdersPage());

      expect(screen.getByRole('status')).toHaveTextContent(
        'orders:0 error:Could not load orders.'
      );
      expect(mocks.getOrderStats).toHaveBeenCalledWith('merchant-1');
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to fetch orders:',
        expect.any(Error)
      );
    } finally {
      consoleError.mockRestore();
    }
  });
});

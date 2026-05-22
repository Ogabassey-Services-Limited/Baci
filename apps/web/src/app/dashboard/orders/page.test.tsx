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
  }: {
    initialOrders?: Array<{ orderNumber: string }>;
  }) => <div data-testid="orders-client">{initialOrders?.length ?? 0}</div>,
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
    expect(screen.getByTestId('orders-client')).toHaveTextContent('0');
  });

  it('keeps the default orders query unfiltered without source=agentic', async () => {
    render(await OrdersPage());

    expect(mocks.getOrders).toHaveBeenCalledWith('merchant-1');
    expect(mocks.getOrders).toHaveBeenCalledTimes(1);
  });
});

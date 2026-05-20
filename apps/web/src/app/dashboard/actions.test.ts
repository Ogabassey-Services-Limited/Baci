import { beforeEach, describe, expect, it, vi } from 'vitest';

const cookies = vi.fn();
const createClient = vi.fn();
const getCachedDashboardStats = vi.fn();

vi.mock('next/headers', () => ({
  cookies: () => cookies(),
}));

vi.mock('@/lib/cached-data', () => ({
  getCachedDashboardStats: (...args: unknown[]) =>
    getCachedDashboardStats(...args),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => createClient(...args),
}));

import { getMonthlyChartData, getRecentSales } from './actions';

interface RecentSalesOrder {
  customer_email: string | null;
  customer_name: string | null;
  id: string;
  payment_status: string;
  total: number | string | null;
}

function mockRecentSalesQuery({
  data,
  error,
}: {
  data: RecentSalesOrder[] | null;
  error: unknown;
}) {
  const limit = vi.fn(async () => ({ data, error }));
  const order = vi.fn(() => ({ limit }));
  const eq = vi.fn(() => ({ eq, order }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));

  createClient.mockReturnValue({ from });

  return { eq, from, limit, order, select };
}

describe('dashboard actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookies.mockResolvedValue({});
  });

  it('limits recent sales to paid orders before rendering them as completed sales', async () => {
    const { eq, from, limit, order, select } = mockRecentSalesQuery({
      data: [
        {
          customer_email: 'ada@example.com',
          customer_name: 'Ada',
          id: 'order-1',
          payment_status: 'paid',
          total: '12500',
        },
      ],
      error: null,
    });

    const sales = await getRecentSales('merchant-1', 3);

    expect(from).toHaveBeenCalledWith('orders');
    expect(select).toHaveBeenCalledWith(
      'id, customer_name, customer_email, total, payment_status'
    );
    expect(eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(eq).toHaveBeenCalledWith('payment_status', 'paid');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(limit).toHaveBeenCalledWith(3);
    expect(sales).toEqual([
      {
        amount: 12500,
        email: 'ada@example.com',
        id: 'order-1',
        name: 'Ada',
        status: 'Completed',
      },
    ]);
  });

  it('returns an empty recent sales list when the paid sales query fails', async () => {
    mockRecentSalesQuery({
      data: null,
      error: { message: 'orders failed' },
    });

    await expect(getRecentSales('merchant-1')).resolves.toEqual([]);
  });

  it('returns an empty recent sales list when there are no paid orders', async () => {
    mockRecentSalesQuery({
      data: [],
      error: null,
    });

    await expect(getRecentSales('merchant-1')).resolves.toEqual([]);
  });

  it('uses customer fallbacks and numeric amounts for paid recent sales', async () => {
    mockRecentSalesQuery({
      data: [
        {
          customer_email: null,
          customer_name: null,
          id: 'order-2',
          payment_status: 'paid',
          total: '990.5',
        },
      ],
      error: null,
    });

    await expect(getRecentSales('merchant-1')).resolves.toEqual([
      {
        amount: 990.5,
        email: 'no-email@example.com',
        id: 'order-2',
        name: 'Unknown Customer',
        status: 'Completed',
      },
    ]);
  });

  it('loads monthly chart data from the dashboard sales RPC', async () => {
    const rpc = vi.fn(async () => ({
      data: [{ month: 'May', orders: 2, profit: 500, revenue: 12500 }],
      error: null,
    }));
    createClient.mockReturnValue({ rpc });

    await expect(getMonthlyChartData('merchant-1')).resolves.toEqual([
      { month: 'May', orders: 2, profit: 500, revenue: 12500 },
    ]);
    expect(rpc).toHaveBeenCalledWith('get_monthly_sales_stats', {
      p_merchant_id: 'merchant-1',
    });
  });

  it('returns an empty monthly chart when the dashboard sales RPC fails', async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { message: 'rpc failed' },
    }));
    createClient.mockReturnValue({ rpc });

    await expect(getMonthlyChartData('merchant-1')).resolves.toEqual([]);
  });
});

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from 'vitest';

vi.mock('@/env', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/env')>();
  return { ...mod, getAppUrl: vi.fn(() => 'http://localhost:3000') };
});

import {
  trackServerSideBeginCheckout,
  trackServerSidePurchase,
} from './server-side-analytics';

describe('Server-Side Analytics error handling', () => {
  const merchantId = 'merch_123';
  const mockUserData = {
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
  };
  const products = [{ id: 'p_1', name: 'Product 1', price: 100, quantity: 1 }];

  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('trackServerSidePurchase handles API errors gracefully', async () => {
    (global.fetch as Mock).mockResolvedValue({
      json: vi
        .fn()
        .mockResolvedValue({ success: false, error: 'Platform Error' }),
    });

    const results = await trackServerSidePurchase(
      merchantId,
      'order_123',
      150,
      'EUR',
      products,
      mockUserData
    );

    expect(global.fetch).toHaveBeenCalledTimes(4);
    expect(results.every((r) => r.success === false)).toBe(true);
    expect(results.every((r) => r.error === 'Platform Error')).toBe(true);
  });

  it('trackServerSideBeginCheckout handles network rejection gracefully', async () => {
    (global.fetch as Mock).mockRejectedValue(new Error('Network failure'));

    const results = await trackServerSideBeginCheckout(
      merchantId,
      150,
      'EUR',
      products,
      mockUserData
    );

    expect(global.fetch).toHaveBeenCalledTimes(4);
    expect(results.every((r) => r.success === false)).toBe(true);
    expect(results.every((r) => r.error === 'Network failure')).toBe(true);
  });
});

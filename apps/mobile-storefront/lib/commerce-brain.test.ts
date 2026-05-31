import { calculateCommerce, CommerceError } from './commerce-brain';

const mockState = {
  invoke: jest.fn(),
  netInfoFetch: jest.fn(),
  trackError: jest.fn(),
  trackEvent: jest.fn(),
};

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: (...args: unknown[]) => mockState.netInfoFetch(...args),
  },
}));

jest.mock('./supabase', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockState.invoke(...args),
    },
  },
}));

jest.mock('./logger', () => ({
  createLogger: () => ({
    error: jest.fn(),
    warn: jest.fn(),
  }),
}));

jest.mock('@/services/analytics', () => ({
  trackError: (...args: unknown[]) => mockState.trackError(...args),
  trackEvent: (...args: unknown[]) => mockState.trackEvent(...args),
}));

describe('commerce-brain', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.netInfoFetch.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });
    mockState.invoke.mockResolvedValue({ data: null, error: null });
  });

  it('throws a typed commerce error when offline', async () => {
    mockState.netInfoFetch.mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
    });

    await expect(
      calculateCommerce('calculate_order', {
        assuranceFee: 100,
        shippingFee: 500,
        subtotal: 1000,
        taxRate: 0.075,
      })
    ).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      name: 'CommerceError',
    });
    expect(mockState.invoke).not.toHaveBeenCalled();
  });

  it('normalizes order totals returned by the commerce edge function', async () => {
    mockState.invoke.mockResolvedValue({
      data: { taxAmount: 75, total: 1575 },
      error: null,
    });

    await expect(
      calculateCommerce('calculate_order', {
        assuranceFee: 100,
        shippingFee: 500,
        subtotal: 1000,
        taxRate: 0.075,
      })
    ).resolves.toEqual({
      taxAmount: 75,
      total: 1675,
    });
    expect(mockState.trackEvent).toHaveBeenCalledWith(
      'commerce_brain_called',
      expect.objectContaining({ action: 'calculate_order', success: true })
    );
  });

  it('returns successful VTU and loyalty redemption payloads', async () => {
    mockState.invoke
      .mockResolvedValueOnce({
        data: {
          commissionRate: 0.03,
          merchantEarning: 20,
          platformEarning: 10,
          totalCommission: 30,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          remainingPoints: 800,
          success: true,
          walletCredit: 1000,
        },
        error: null,
      });

    await expect(
      calculateCommerce('calculate_vtu', {
        amount: 1000,
        provider: 'mtn',
      })
    ).resolves.toEqual({
      commissionRate: 0.03,
      merchantEarning: 20,
      platformEarning: 10,
      totalCommission: 30,
    });
    expect(mockState.trackEvent).toHaveBeenCalledWith(
      'commerce_brain_called',
      expect.objectContaining({ action: 'calculate_vtu', success: true })
    );

    await expect(
      calculateCommerce('redeem_loyalty', {
        currentPoints: 1000,
        points: 200,
      })
    ).resolves.toEqual({
      remainingPoints: 800,
      success: true,
      walletCredit: 1000,
    });
  });

  it('rejects with a timeout commerce error when the edge call hangs', async () => {
    jest.useFakeTimers();
    mockState.invoke.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ data: null, error: null }), 31_000);
        })
    );

    try {
      const result = calculateCommerce('calculate_vtu', {
        amount: 1000,
        provider: 'mtn',
      });
      const expectation = expect(result).rejects.toMatchObject({
        code: 'TIMEOUT_ERROR',
        name: 'CommerceError',
      });
      await jest.advanceTimersByTimeAsync(30_000);
      await expectation;
    } finally {
      jest.useRealTimers();
    }
  });

  it('falls back to local order totals when the edge request cannot be sent', async () => {
    mockState.invoke.mockRejectedValue(
      Object.assign(
        new Error('Failed to send a request to the Edge Function'),
        {
          name: 'FunctionsFetchError',
        }
      )
    );

    await expect(
      calculateCommerce('calculate_order', {
        assuranceFee: 100,
        shippingFee: 500,
        subtotal: 1000,
        taxRate: 0.075,
      })
    ).resolves.toEqual({
      taxAmount: 75,
      total: 1675,
    });
    expect(mockState.trackEvent).toHaveBeenCalledWith(
      'commerce_brain_fallback',
      expect.objectContaining({ action: 'calculate_order' })
    );
  });

  it('rethrows commerce brain errors after tracking them', async () => {
    const error = new CommerceError('Remote failed', 'REMOTE_FAILED');
    mockState.invoke.mockResolvedValue({ data: null, error });

    await expect(
      calculateCommerce('calculate_vtu', {
        amount: 1000,
        provider: 'mtn',
      })
    ).rejects.toMatchObject({ code: 'REMOTE_FAILED' });
    expect(mockState.trackError).toHaveBeenCalledWith(
      'commerce_brain_error',
      'Remote failed',
      expect.objectContaining({ action: 'calculate_vtu' })
    );
  });

  it('rethrows non-fallback order errors after tracking them', async () => {
    const error = new Error('Validation failed');
    mockState.invoke.mockResolvedValue({ data: null, error });

    await expect(
      calculateCommerce('calculate_order', {
        assuranceFee: 100,
        shippingFee: 500,
        subtotal: 1000,
        taxRate: 0.075,
      })
    ).rejects.toThrow('Validation failed');
    expect(mockState.trackError).toHaveBeenCalledWith(
      'commerce_brain_error',
      'Validation failed',
      expect.objectContaining({ action: 'calculate_order' })
    );
  });
});

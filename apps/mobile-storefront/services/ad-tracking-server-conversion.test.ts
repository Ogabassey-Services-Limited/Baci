import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockDebug = jest.fn();
const mockWarn = jest.fn();
const mockGetIsTrackingAllowed = jest.fn(() => false);
const mockFetch =
  jest.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >();

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { apiUrl: 'https://api.test' } } },
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: mockDebug,
    error: jest.fn(),
    info: jest.fn(),
    warn: mockWarn,
  }),
}));

jest.mock('./ad-tracking-state', () => ({
  AD_API_URL: 'https://api.test',
  adTrackingLog: {
    debug: mockDebug,
    error: jest.fn(),
    info: jest.fn(),
    warn: mockWarn,
  },
  getCachedMerchantId: () => 'merchant-1',
  getCachedUserData: () => ({ email: 'shopper@example.com' }),
  getIsTrackingAllowed: () => mockGetIsTrackingAllowed(),
}));

jest.mock('./ad-tracking-runtime', () => ({
  AD_TRACKING_PLATFORM: 'ios',
}));

describe('sendServerConversion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetIsTrackingAllowed.mockReturnValue(false);
    mockFetch.mockResolvedValue({
      json: async () => ({ success: true }),
      text: async () => '',
    } as Response);
    global.fetch = mockFetch;
  });

  it('does not forward advertising conversions without ATT authorization', async () => {
    const { sendServerConversion } = await import(
      './ad-tracking-server-conversion'
    );

    await sendServerConversion('PURCHASE', 'event-1', {
      currency: 'NGN',
      value: 1000,
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('forwards advertising conversions after ATT authorization', async () => {
    mockGetIsTrackingAllowed.mockReturnValue(true);
    const { sendServerConversion } = await import(
      './ad-tracking-server-conversion'
    );

    await sendServerConversion('PURCHASE', 'event-2', {
      currency: 'NGN',
      value: 1000,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.test/analytics/conversion',
      expect.objectContaining({ method: 'POST' })
    );
  });
});

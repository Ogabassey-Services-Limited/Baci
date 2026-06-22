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
  sendServerSideAnalytics,
  trackServerSideBeginCheckout,
  trackServerSidePurchase,
} from './server-side-analytics';

type FetchCall = [string, RequestInit];

type AnalyticsRequestBody = {
  event: string;
  eventData: Record<string, unknown>;
};

function parseRequestBody(call: FetchCall): AnalyticsRequestBody {
  expect(call[1]).toBeDefined();
  expect(call[1].body).toBeDefined();
  return JSON.parse(call[1].body as string) as AnalyticsRequestBody;
}

describe('Server-Side Analytics Service', () => {
  const merchantId = 'merch_123';
  const mockUserData = {
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
  };
  const mockEventData = {
    value: 100,
    currency: 'USD',
    products: [{ id: 'p_1', name: 'Product 1', price: 100, quantity: 1 }],
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('sendServerSideAnalytics', () => {
    it('sends events to all platforms successfully', async () => {
      // Mock successful fetch for all requests
      (global.fetch as Mock).mockResolvedValue({
        json: vi.fn().mockResolvedValue({ success: true }),
      });

      const results = await sendServerSideAnalytics(
        merchantId,
        'purchase',
        mockUserData,
        mockEventData
      );

      expect(global.fetch).toHaveBeenCalledTimes(4);

      const platforms = results.map((r) => r.platform);
      expect(platforms).toContain('GA4');
      expect(platforms).toContain('Facebook');
      expect(platforms).toContain('TikTok');
      expect(platforms).toContain('Snapchat');

      expect(results.every((r) => r.success === true)).toBe(true);
      expect(results.every((r) => r.sent === true)).toBe(true);
    });

    it('uses the configured app URL when running without window', async () => {
      vi.stubGlobal('window', undefined);
      (global.fetch as Mock).mockResolvedValue({
        json: vi.fn().mockResolvedValue({ success: true }),
      });

      const results = await sendServerSideAnalytics(
        merchantId,
        'purchase',
        mockUserData,
        mockEventData
      );

      expect(global.fetch).toHaveBeenCalledTimes(4);
      const calls = (global.fetch as Mock).mock.calls as FetchCall[];
      expect(
        calls.every(([url]) =>
          url.startsWith('http://localhost:3000/api/analytics/')
        )
      ).toBe(true);
      expect(results.every((result) => result.success === true)).toBe(true);
    });

    it('handles failures from some platforms gracefully', async () => {
      // Mock failure for Facebook, success for others
      (global.fetch as Mock).mockImplementation((url: string) => {
        if (url.includes('facebook')) {
          return Promise.reject(new Error('Network error'));
        }
        if (url.includes('tiktok')) {
          return Promise.resolve({
            json: vi
              .fn()
              .mockResolvedValue({ success: false, error: 'API Error' }),
          });
        }
        return Promise.resolve({
          json: vi.fn().mockResolvedValue({ success: true }),
        });
      });

      const results = await sendServerSideAnalytics(
        merchantId,
        'purchase',
        mockUserData,
        mockEventData
      );

      expect(global.fetch).toHaveBeenCalledTimes(4);

      const fbResult = results.find((r) => r.platform === 'Facebook');
      expect(fbResult?.success).toBe(false);
      expect(fbResult?.error).toBe('Network error');
      expect(fbResult?.sent).toBe(false);

      const tiktokResult = results.find((r) => r.platform === 'TikTok');
      expect(tiktokResult?.success).toBe(false);
      expect(tiktokResult?.error).toBe('API Error');
      expect(tiktokResult?.sent).toBe(true); // sent defaults to true if not explicitly false in API response

      const ga4Result = results.find((r) => r.platform === 'GA4');
      expect(ga4Result?.success).toBe(true);
    });
  });

  describe('trackServerSidePurchase', () => {
    it('calls sendServerSideAnalytics with purchase event mapping for platforms', async () => {
      (global.fetch as Mock).mockResolvedValue({
        json: vi.fn().mockResolvedValue({ success: true }),
      });

      await trackServerSidePurchase(
        merchantId,
        'order_123',
        150,
        'EUR',
        mockEventData.products,
        mockUserData
      );

      expect(global.fetch).toHaveBeenCalledTimes(4);

      const calls = (global.fetch as Mock).mock.calls as FetchCall[];

      const fbCall = calls.find((call) => call[0].includes('facebook'));
      expect(fbCall).toBeDefined();
      if (fbCall) {
        const fbCallBody = parseRequestBody(fbCall);
        expect(fbCallBody.event).toBe('Purchase');
        expect(fbCallBody.eventData).toMatchObject({
          value: 150,
          currency: 'EUR',
          transactionId: 'order_123',
          products: mockEventData.products,
        });
      }

      const ga4Call = calls.find((call) => call[0].includes('ga4'));
      expect(ga4Call).toBeDefined();
      if (ga4Call) {
        const ga4CallBody = parseRequestBody(ga4Call);
        expect(ga4CallBody.event).toBe('purchase');
        expect(ga4CallBody.eventData).toMatchObject({
          value: 150,
          currency: 'EUR',
          transactionId: 'order_123',
          products: mockEventData.products,
        });
      }

      const tiktokCall = calls.find((call) => call[0].includes('tiktok'));
      expect(tiktokCall).toBeDefined();
      if (tiktokCall) {
        const tiktokCallBody = parseRequestBody(tiktokCall);
        expect(tiktokCallBody.event).toBe('purchase');
        expect(tiktokCallBody.eventData).toMatchObject({
          value: 150,
          currency: 'EUR',
          transactionId: 'order_123',
          orderId: 'order_123',
          products: mockEventData.products,
        });
      }

      const snapchatCall = calls.find((call) => call[0].includes('snapchat'));
      expect(snapchatCall).toBeDefined();
      if (snapchatCall) {
        const snapchatCallBody = parseRequestBody(snapchatCall);
        expect(snapchatCallBody.event).toBe('purchase');
        expect(snapchatCallBody.eventData).toMatchObject({
          value: 150,
          currency: 'EUR',
          transactionId: 'order_123',
          products: mockEventData.products,
        });
      }
    });
  });

  describe('trackServerSideBeginCheckout', () => {
    it('calls sendServerSideAnalytics with begin_checkout event mapping for platforms', async () => {
      (global.fetch as Mock).mockResolvedValue({
        json: vi.fn().mockResolvedValue({ success: true }),
      });

      await trackServerSideBeginCheckout(
        merchantId,
        150,
        'EUR',
        mockEventData.products,
        mockUserData
      );

      expect(global.fetch).toHaveBeenCalledTimes(4);

      const calls = (global.fetch as Mock).mock.calls as FetchCall[];

      const fbCall = calls.find((call) => call[0].includes('facebook'));
      expect(fbCall).toBeDefined();
      if (fbCall) {
        const fbCallBody = parseRequestBody(fbCall);
        expect(fbCallBody.event).toBe('InitiateCheckout');
        expect(fbCallBody.eventData).toMatchObject({
          value: 150,
          currency: 'EUR',
          products: mockEventData.products,
        });
      }

      const ga4Call = calls.find((call) => call[0].includes('ga4'));
      expect(ga4Call).toBeDefined();
      if (ga4Call) {
        const ga4CallBody = parseRequestBody(ga4Call);
        expect(ga4CallBody.event).toBe('begin_checkout');
        expect(ga4CallBody.eventData).toMatchObject({
          value: 150,
          currency: 'EUR',
          products: mockEventData.products,
        });
      }

      const tiktokCall = calls.find((call) => call[0].includes('tiktok'));
      expect(tiktokCall).toBeDefined();
      if (tiktokCall) {
        const tiktokCallBody = parseRequestBody(tiktokCall);
        expect(tiktokCallBody.event).toBe('begin_checkout');
        expect(tiktokCallBody.eventData).toMatchObject({
          value: 150,
          currency: 'EUR',
          products: mockEventData.products,
        });
      }

      const snapchatCall = calls.find((call) => call[0].includes('snapchat'));
      expect(snapchatCall).toBeDefined();
      if (snapchatCall) {
        const snapchatCallBody = parseRequestBody(snapchatCall);
        expect(snapchatCallBody.event).toBe('begin_checkout');
        expect(snapchatCallBody.eventData).toMatchObject({
          value: 150,
          currency: 'EUR',
          products: mockEventData.products,
        });
      }
    });
  });
});

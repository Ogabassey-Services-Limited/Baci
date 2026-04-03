import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KudaServiceType, NetworkProvider } from './kuda'; // Enums are fine to import statically

// Mock dependencies
const MOCK_API_BASE = 'https://kuda-openapi.kuda.com/v2.1';

describe('Kuda API Client', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules(); // This wipes the module registry
    vi.stubEnv('KUDA_API_BASE_URL', MOCK_API_BASE);
    vi.stubEnv('KUDA_EMAIL', 'test@example.com');
    vi.stubEnv('KUDA_API_KEY', 'test-api-key');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // Helper to mock generic Kuda API success response
  const mockKudaResponse = (data: any, message = 'Success') => {
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          status: true,
          message,
          data,
        }),
    } as Response);
  };

  describe('Authentication', () => {
    it('retrieves a token successfully', async () => {
      // Dynamic import to ensure we get a fresh module with null cachedToken
      const { purchaseAirtime } = await import('./kuda');

      const fetchMock = vi.fn().mockImplementation((url, _options) => {
        if (url.toString().includes('GetToken')) {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve('new-token'),
          } as Response);
        }
        return mockKudaResponse({ reference: 'tx-123' });
      });
      globalThis.fetch = fetchMock;

      await purchaseAirtime('08012345678', 100, NetworkProvider.MTN);

      // Verify GetToken was called
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('GetToken'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('test@example.com'),
        })
      );
    });
  });

  describe('purchaseAirtime', () => {
    it('sends correct payload for MTN airtime purchase', async () => {
      const { purchaseAirtime } = await import('./kuda');

      const fetchMock = vi.fn().mockImplementation((url) => {
        if (url.toString().includes('GetToken')) {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve('valid-token'),
          } as Response);
        }
        return mockKudaResponse({ reference: 'tx-mtn-123', pin: null });
      });
      globalThis.fetch = fetchMock;

      const result = await purchaseAirtime(
        '08030000000',
        500,
        NetworkProvider.MTN
      );

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('tx-mtn-123');

      // Find the actual purchase call (not the auth one)
      const purchaseCall = fetchMock.mock.calls.find(
        (call) => call[0] === MOCK_API_BASE
      );
      expect(purchaseCall).toBeDefined();

      const payload = JSON.parse(purchaseCall?.[1]?.body as string);
      expect(payload.serviceType).toBe(KudaServiceType.ADMIN_PURCHASE_BILL);
      expect(payload.Data.BillItemIdentifier).toBe('KD-VTU-MTNNG');
      expect(payload.Data.Amount).toBe('50000'); // 500 Naira = 50000 Kobo
      expect(payload.Data.PhoneNumber).toBe('08030000000');
      expect(result.reference).toBeDefined();
      expect(payload.Data.trackingReference).toBe(result.reference);
    });

    it('handles API errors gracefully', async () => {
      const { purchaseAirtime } = await import('./kuda');

      const fetchMock = vi.fn().mockImplementation((url) => {
        if (url.toString().includes('GetToken'))
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve('token'),
          } as Response);

        // Return failure from Kuda
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              status: false,
              message: 'Insufficient balance',
            }),
        } as Response);
      });
      globalThis.fetch = fetchMock;

      const result = await purchaseAirtime(
        '08030000000',
        500000,
        NetworkProvider.MTN
      );

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.message).toBe('Insufficient balance');
    });

    it('returns error for invalid network provider', async () => {
      const { purchaseAirtime } = await import('./kuda');
      // @ts-expect-error - Testing invalid input
      const result = await purchaseAirtime('08030000000', 100, 'INVALID_NET');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid network provider');
    });
  });

  describe('purchaseData', () => {
    it('sends correct payload for Data purchase', async () => {
      const { purchaseData } = await import('./kuda');

      const fetchMock = vi.fn().mockImplementation((url) => {
        if (url.toString().includes('GetToken'))
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve('token'),
          } as Response);
        return mockKudaResponse({ reference: 'tx-data-123' });
      });
      globalThis.fetch = fetchMock;

      const dataPlanCode = 'MTN-1GB-MONTHLY';
      const result = await purchaseData(
        '08030000000',
        dataPlanCode,
        1000,
        NetworkProvider.MTN
      );

      expect(result.success).toBe(true);

      const purchaseCall = fetchMock.mock.calls.find(
        (call) => call[0] === MOCK_API_BASE
      );
      const payload = JSON.parse(purchaseCall?.[1]?.body as string);

      expect(payload.Data.BillItemIdentifier).toBe(dataPlanCode);
      expect(payload.Data.Amount).toBe('100000'); // 1000 Naira = 100000 Kobo
      expect(payload.Data.trackingReference).toBe(result.reference);
    });
  });
});

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
    vi.useRealTimers();
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
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('fails fast when the token request times out', async () => {
      const { purchaseAirtime } = await import('./kuda');
      vi.useFakeTimers();

      globalThis.fetch = vi.fn().mockImplementation((_url, options) => {
        const signal = options?.signal as AbortSignal;
        return new Promise((_resolve, reject) => {
          signal.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true }
          );
        });
      });

      const purchasePromise = purchaseAirtime(
        '08012345678',
        100,
        NetworkProvider.MTN
      );

      await vi.advanceTimersByTimeAsync(15000);

      await expect(purchasePromise).resolves.toMatchObject({
        success: false,
        message: 'Purchase failed',
      });
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
      expect(purchaseCall?.[1]?.signal).toBeInstanceOf(AbortSignal);
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

    it('returns a timeout error when the purchase request stalls', async () => {
      const { purchaseAirtime } = await import('./kuda');
      vi.useFakeTimers();

      globalThis.fetch = vi.fn().mockImplementation((url, options) => {
        if (url.toString().includes('GetToken')) {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve('token'),
          } as Response);
        }

        const signal = options?.signal as AbortSignal;
        return new Promise((_resolve, reject) => {
          signal.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true }
          );
        });
      });

      const purchasePromise = purchaseAirtime(
        '08030000000',
        500,
        NetworkProvider.MTN
      );

      await vi.advanceTimersByTimeAsync(15000);

      const result = await purchasePromise;

      expect(result.success).toBe(false);
      expect(result.message).toBe('Purchase failed');
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

  describe('checkTransactionStatus', () => {
    it('queries bill status by response ref, then request ref, and returns the token', async () => {
      const { checkTransactionStatus } = await import('@/lib/kuda');

      const fetchMock = vi.fn().mockImplementation((url, options) => {
        if (url.toString().includes('GetToken')) {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve('token'),
          } as Response);
        }

        const payload = JSON.parse(String(options?.body));
        if (payload.Data.BillResponseReference) {
          return mockKudaResponse({ finalStatus: 'successful' }, 'No token');
        }

        return mockKudaResponse(
          { FinalStatus: 'successful', Pin: '1234-5678-9012' },
          'Token found'
        );
      });
      globalThis.fetch = fetchMock;

      const result = await checkTransactionStatus('kuda-bill-1', 'VTU-123');

      expect(result).toEqual({
        message: 'Token found',
        pin: '1234-5678-9012',
        status: 'successful',
      });

      const statusPayloads = fetchMock.mock.calls
        .filter((call) => call[0] === MOCK_API_BASE)
        .map((call) => JSON.parse(String(call[1]?.body)));
      expect(statusPayloads).toEqual([
        expect.objectContaining({
          Data: { BillResponseReference: 'kuda-bill-1' },
          serviceType: KudaServiceType.BILL_TSQ,
        }),
        expect.objectContaining({
          Data: { BillRequestRef: 'VTU-123' },
          serviceType: KudaServiceType.BILL_TSQ,
        }),
      ]);
    });

    it('returns the highest-priority observed status when no token is found', async () => {
      const { checkTransactionStatus } = await import('./kuda');

      const fetchMock = vi.fn().mockImplementation((url, options) => {
        if (url.toString().includes('GetToken')) {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve('token'),
          } as Response);
        }

        const payload = JSON.parse(String(options?.body));
        if (payload.Data.BillResponseReference) {
          return mockKudaResponse({ finalStatus: 'failed' }, 'Failed');
        }

        return mockKudaResponse({ FinalStatus: 'processing' }, 'Processing');
      });
      globalThis.fetch = fetchMock;

      const result = await checkTransactionStatus('kuda-bill-1', 'VTU-123');

      expect(result).toEqual({
        message: 'Processing',
        status: 'processing',
      });
    });

    it('throws all reference query errors when every status query fails', async () => {
      const { checkTransactionStatus } = await import('./kuda');

      const responseRefError = new Error('response reference failed');
      const requestRefError = new Error('request reference failed');
      const fetchMock = vi.fn().mockImplementation((url, options) => {
        if (url.toString().includes('GetToken')) {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve('token'),
          } as Response);
        }

        const payload = JSON.parse(String(options?.body));
        if (payload.Data.BillResponseReference) {
          return Promise.reject(responseRefError);
        }

        return Promise.reject(requestRefError);
      });
      globalThis.fetch = fetchMock;

      await expect(
        checkTransactionStatus('kuda-bill-1', 'VTU-123')
      ).rejects.toMatchObject({
        errors: [responseRefError, requestRefError],
        message: 'All Kuda transaction status queries failed',
      });
    });
  });

  describe('getBillersByType', () => {
    it('maps Kuda electricity bill items that use kudaIdentifier and name fields', async () => {
      const { getBillersByType } = await import('./kuda');

      const fetchMock = vi.fn().mockImplementation((url) => {
        if (url.toString().includes('GetToken')) {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve('token'),
          } as Response);
        }

        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              status: true,
              message: 'Operation successful',
              data: {
                billers: [
                  {
                    id: 'ekedc',
                    name: 'EKEDC NG',
                    description: 'Electricity',
                    billTypeId: 'electricity',
                    billItems: [
                      {
                        id: '2e38a937-842c-4f92-aaaa-3e2f16919060',
                        name: 'EKEDC PREPAID',
                        kudaIdentifier: 'KUD-ELE-EKED-002',
                        amount: 0,
                        isFixedPrice: false,
                        billerId: 'ekedc',
                      },
                      {
                        id: '9daaa91b-0177-4de4-ba3b-9c86f14848ed',
                        name: 'EKEDC POSTPAID',
                        kudaIdentifier: 'KUD-ELE-EKED-001',
                        amount: 0,
                        isFixedPrice: false,
                        billerId: 'ekedc',
                      },
                    ],
                  },
                ],
              },
            }),
        } as Response);
      });

      globalThis.fetch = fetchMock;

      const result = await getBillersByType('Electricity');

      expect(result[0].billItems).toEqual([
        expect.objectContaining({
          itemCode: 'KUD-ELE-EKED-002',
          itemName: 'EKEDC PREPAID',
          isAmountFixed: false,
        }),
        expect.objectContaining({
          itemCode: 'KUD-ELE-EKED-001',
          itemName: 'EKEDC POSTPAID',
          isAmountFixed: false,
        }),
      ]);
    });

    it('preserves nested bill items from the provider response', async () => {
      const { getBillersByType } = await import('./kuda');

      const fetchMock = vi.fn().mockImplementation((url) => {
        if (url.toString().includes('GetToken')) {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve('token'),
          } as Response);
        }

        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              status: true,
              message: 'Operation successful',
              data: {
                billers: [
                  {
                    id: 'ekedc',
                    name: 'EKEDC NG',
                    description: 'Electricity',
                    billTypeId: 'electricity',
                    billItems: [
                      {
                        itemCode: 'prepaid',
                        itemName: 'Prepaid',
                        amount: 0,
                        itemCurrencySymbol: 'NGN',
                        isAmountFixed: false,
                        itemFee: 0,
                        billItems: [
                          {
                            itemCode: 'residential',
                            itemName: 'Residential',
                            amount: 0,
                            itemCurrencySymbol: 'NGN',
                            isAmountFixed: false,
                            itemFee: 0,
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            }),
        } as Response);
      });

      globalThis.fetch = fetchMock;

      const result = await getBillersByType('Electricity');

      expect(result).toEqual([
        expect.objectContaining({
          billerId: 'ekedc',
          billItems: [
            expect.objectContaining({
              itemCode: 'prepaid',
              billItems: [
                expect.objectContaining({
                  itemCode: 'residential',
                }),
              ],
            }),
          ],
        }),
      ]);
    });
  });
});

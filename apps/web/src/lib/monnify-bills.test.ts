import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCacheLife, mockCacheTag } = vi.hoisted(() => ({
  mockCacheLife: vi.fn(),
  mockCacheTag: vi.fn(),
}));

vi.mock('next/cache', () => ({
  cacheLife: mockCacheLife,
  cacheTag: mockCacheTag,
}));

import {
  checkTransactionStatus,
  getBillerCategories,
  getBillerProducts,
  getBillers,
  getCachedBillerProducts,
  getCachedBillers,
  purchaseBill,
  verifyBillCustomer,
} from './monnify-bills';

vi.mock('@/lib/monnify', () => ({
  getMonnifyToken: vi.fn().mockResolvedValue('mock-token'),
}));

vi.mock('@/env', () => ({
  getMonnifyBaseUrl: () => 'https://sandbox.monnify.com',
}));

describe('Monnify Bills Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Discovery Helpers', () => {
    it('getBillerCategories returns unwrapped categories list', async () => {
      const mockEnvelope = {
        requestSuccessful: true,
        responseCode: 0,
        responseMessage: 'success',
        responseBody: [
          { name: 'Utility', description: 'Utility Payments', code: 'UTILITY' },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockEnvelope),
      });

      const result = await getBillerCategories();
      expect(result).toEqual([
        { name: 'Utility', description: 'Utility Payments', code: 'UTILITY' },
      ]);
    });

    it('getBillerCategories unwraps current paginated category responses', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          requestSuccessful: true,
          responseCode: '0',
          responseMessage: 'success',
          responseBody: {
            content: [{ code: 'AIRTIME', name: 'AIRTIME' }],
            totalElements: 1,
          },
        }),
      });

      const result = await getBillerCategories();
      expect(result).toEqual([{ code: 'AIRTIME', name: 'AIRTIME' }]);
    });

    it('getBillers returns unwrapped billers list', async () => {
      const mockEnvelope = {
        requestSuccessful: true,
        responseCode: '0',
        responseMessage: 'success',
        responseBody: [
          {
            name: 'IKEDC',
            description: 'Ikeja Electric',
            billerCode: 'IKEDC',
            billerCategoryCode: 'UTILITY',
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockEnvelope),
      });

      const result = await getBillers('UTILITY');
      expect(result).toEqual([
        {
          name: 'IKEDC',
          description: 'Ikeja Electric',
          billerCode: 'IKEDC',
          billerCategoryCode: 'UTILITY',
          categoryCodes: ['UTILITY'],
        },
      ]);
    });

    it('getBillers normalizes current Monnify biller responses', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          requestSuccessful: true,
          responseCode: '0',
          responseMessage: 'success',
          responseBody: {
            content: [
              {
                code: 'MTN',
                name: 'MTN',
                categories: [{ code: 'AIRTIME', name: 'AIRTIME' }],
              },
            ],
          },
        }),
      });

      const result = await getBillers('AIRTIME');
      expect(result).toEqual([
        {
          name: 'MTN',
          description: 'MTN',
          billerCode: 'MTN',
          billerCategoryCode: 'AIRTIME',
          categoryCodes: ['AIRTIME'],
        },
      ]);
    });

    it('getBillers rejects current Monnify billers without category references', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          requestSuccessful: true,
          responseCode: '0',
          responseMessage: 'success',
          responseBody: {
            content: [
              {
                code: 'MTN',
                name: 'MTN',
                categories: [],
              },
            ],
          },
        }),
      });

      await expect(getBillers('AIRTIME')).rejects.toThrow(
        'At least one Monnify category is required'
      );
    });

    it('getCachedBillers delegates cached category discovery by category code', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          requestSuccessful: true,
          responseCode: '0',
          responseMessage: 'success',
          responseBody: {
            content: [
              {
                code: 'MTN',
                name: 'MTN',
                categories: [{ code: 'AIRTIME', name: 'AIRTIME' }],
              },
            ],
          },
        }),
      });

      const result = await getCachedBillers('AIRTIME');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://sandbox.monnify.com/api/v1/vas/bills-payment/billers?categoryCode=AIRTIME',
        expect.objectContaining({ method: 'GET' })
      );
      expect(result).toEqual([
        expect.objectContaining({
          billerCode: 'MTN',
          categoryCodes: ['AIRTIME'],
        }),
      ]);
      expect(mockCacheLife).toHaveBeenCalledWith({
        stale: 60,
        revalidate: 300,
        expire: 3600,
      });
      expect(mockCacheTag).toHaveBeenCalledWith(
        'monnify-discovery',
        'monnify-billers-AIRTIME'
      );
    });

    it('getBillerProducts returns unwrapped products list', async () => {
      const mockEnvelope = {
        requestSuccessful: true,
        responseCode: '0',
        responseMessage: 'success',
        responseBody: [
          {
            productCode: 'IKEDC-PREPAID',
            name: 'Prepaid',
            billerCode: 'IKEDC',
            fee: '100',
            amount: '0',
            isAmountFixed: 'false',
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockEnvelope),
      });

      const result = await getBillerProducts('IKEDC');
      expect(result).toEqual([
        {
          productCode: 'IKEDC-PREPAID',
          name: 'Prepaid',
          billerCode: 'IKEDC',
          fee: 100,
          amount: 0,
          isAmountFixed: false,
          categoryCode: undefined,
          maxAmount: null,
          minAmount: null,
        },
      ]);
    });

    it('getBillerProducts normalizes current Monnify product responses', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          requestSuccessful: true,
          responseCode: '0',
          responseMessage: 'success',
          responseBody: {
            content: [
              {
                code: '13',
                name: 'MTN Mobile Top up',
                category: { code: 'AIRTIME', name: 'AIRTIME' },
                biller: { code: 'MTN', name: 'MTN' },
                minAmount: 100,
                maxAmount: null,
                price: null,
                priceType: 'OPEN',
              },
            ],
          },
        }),
      });

      const result = await getBillerProducts('MTN');
      expect(result).toEqual([
        {
          productCode: '13',
          name: 'MTN Mobile Top up',
          billerCode: 'MTN',
          fee: null,
          amount: null,
          isAmountFixed: false,
          categoryCode: 'AIRTIME',
          maxAmount: null,
          minAmount: 100,
        },
      ]);
    });

    it('getCachedBillerProducts delegates cached product discovery by biller code', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          requestSuccessful: true,
          responseCode: '0',
          responseMessage: 'success',
          responseBody: {
            content: [
              {
                code: '13',
                name: 'MTN Mobile Top up',
                category: { code: 'AIRTIME', name: 'AIRTIME' },
                biller: { code: 'MTN', name: 'MTN' },
                minAmount: 100,
                maxAmount: null,
                price: null,
                priceType: 'OPEN',
              },
            ],
          },
        }),
      });

      const result = await getCachedBillerProducts('MTN');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://sandbox.monnify.com/api/v1/vas/bills-payment/biller-products?billerCode=MTN',
        expect.objectContaining({ method: 'GET' })
      );
      expect(result).toEqual([
        expect.objectContaining({
          billerCode: 'MTN',
          productCode: '13',
        }),
      ]);
      expect(mockCacheLife).toHaveBeenCalledWith({
        stale: 60,
        revalidate: 300,
        expire: 3600,
      });
      expect(mockCacheTag).toHaveBeenCalledWith(
        'monnify-discovery',
        'monnify-biller-products-MTN'
      );
    });

    it('removes caller abort listeners after discovery requests settle', async () => {
      const controller = new AbortController();
      const addListener = vi.spyOn(controller.signal, 'addEventListener');
      const removeListener = vi.spyOn(controller.signal, 'removeEventListener');
      const mockEnvelope = {
        requestSuccessful: true,
        responseCode: '0',
        responseMessage: 'success',
        responseBody: [],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockEnvelope),
      });

      await getBillerProducts('IKEDC', { signal: controller.signal });

      expect(addListener).toHaveBeenCalledWith('abort', expect.any(Function), {
        once: true,
      });
      expect(removeListener).toHaveBeenCalledWith(
        'abort',
        addListener.mock.calls[0]?.[1]
      );
    });

    it('throws on HTTP OK Monnify discovery business failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          requestSuccessful: true,
          responseCode: '1',
          responseMessage: 'Category unavailable',
          responseBody: [],
        }),
      });

      await expect(getBillerCategories()).rejects.toThrow(
        'Category unavailable'
      );
    });

    it('rejects malformed Monnify product pricing instead of defaulting to zero', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          requestSuccessful: true,
          responseCode: '0',
          responseMessage: 'success',
          responseBody: [
            {
              productCode: 'IKEDC-PREPAID',
              name: 'Prepaid',
              billerCode: 'IKEDC',
              fee: 'not-a-number',
              amount: 0,
              isAmountFixed: false,
            },
          ],
        }),
      });

      await expect(getBillerProducts('IKEDC')).rejects.toThrow();
    });

    it('propagates HTTP and network errors on discovery helpers', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(getBillerCategories()).rejects.toThrow(
        'Monnify server error'
      );
    });

    it('keeps HTTP 5xx response body details out of discovery helper messages', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: vi.fn().mockResolvedValue(
          JSON.stringify({
            responseMessage: 'Gateway failed for request 1234567',
          })
        ),
      });

      await expect(getBillerCategories()).rejects.toThrow(
        'Monnify server error: 500 Internal Server Error'
      );
      await expect(getBillerCategories()).rejects.not.toThrow(
        'Gateway failed for request'
      );
    });
  });

  describe('verifyBillCustomer', () => {
    it('returns flat validation details on success', async () => {
      const mockResponse = {
        requestSuccessful: true,
        responseCode: '0',
        responseMessage: 'success',
        responseBody: {
          customerName: 'JANE DOE',
          validationReference: 'VAL-123',
          requireValidationRef: true,
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await verifyBillCustomer(
        'IKEDC',
        'IKEDC-PREPAID',
        '12345678'
      );
      expect(result).toEqual({
        verified: true,
        customerName: 'JANE DOE',
        validationReference: 'VAL-123',
        requireValidationRef: true,
        message: 'success',
      });
    });

    it('sends only documented Monnify validate-customer fields', async () => {
      const mockResponse = {
        requestSuccessful: true,
        responseCode: '0',
        responseMessage: 'success',
        responseBody: {
          customerName: 'JANE DOE',
          requireValidationRef: false,
        },
      };
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });
      global.fetch = fetchSpy;

      const result = await verifyBillCustomer(
        'IKEDC',
        'IKEDC-PREPAID',
        '12345678'
      );

      expect(result.verified).toBe(true);
      expect(JSON.parse(fetchSpy.mock.calls[0]?.[1]?.body as string)).toEqual({
        productCode: 'IKEDC-PREPAID',
        customerId: '12345678',
      });
    });

    it('returns nested vendInstruction validation details on success', async () => {
      const mockResponse = {
        requestSuccessful: true,
        responseCode: '0',
        responseMessage: 'success',
        responseBody: {
          customerName: 'JANE DOE',
          vendInstruction: {
            validationReference: 'VAL-NESTED-999',
            requireValidationRef: true,
          },
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await verifyBillCustomer(
        'IKEDC',
        'IKEDC-PREPAID',
        '12345678'
      );
      expect(result).toEqual({
        verified: true,
        customerName: 'JANE DOE',
        validationReference: 'VAL-NESTED-999',
        requireValidationRef: true,
        message: 'success',
      });
    });

    it('handles verification failure gracefully without throwing', async () => {
      const mockResponse = {
        requestSuccessful: false,
        responseCode: '99',
        responseMessage: 'Invalid meter number',
        responseBody: null,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await verifyBillCustomer(
        'IKEDC',
        'IKEDC-PREPAID',
        '12345678'
      );
      expect(result.verified).toBe(false);
      expect(result.message).toContain('Invalid meter number');
    });

    it('returns a safe verification failure for HTTP OK non-zero responseCode', async () => {
      const mockResponse = {
        requestSuccessful: true,
        responseCode: '1',
        responseMessage: 'Customer validation failed',
        responseBody: {
          customerName: 'JANE DOE',
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await verifyBillCustomer(
        'IKEDC',
        'IKEDC-PREPAID',
        '12345678'
      );
      expect(result.verified).toBe(false);
      expect(result.message).toContain('Customer validation failed');
    });

    it('handles verification exceptions gracefully returning safe failure shape', async () => {
      global.fetch = vi
        .fn()
        .mockRejectedValue(new Error('Network disconnected'));

      const result = await verifyBillCustomer(
        'IKEDC',
        'IKEDC-PREPAID',
        '12345678'
      );
      expect(result.verified).toBe(false);
      expect(result.message).toContain('Network disconnected');
    });

    it('does not expose Monnify HTTP body diagnostics in verification responses', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: vi.fn().mockResolvedValue(
          JSON.stringify({
            responseMessage:
              'Provider wallet 1234567890 cannot validate customer 08012345678',
          })
        ),
      });

      const result = await verifyBillCustomer(
        'IKEDC',
        'IKEDC-PREPAID',
        '12345678'
      );

      expect(result.verified).toBe(false);
      expect(result.message).toBe(
        'Verification could not be completed with Monnify. Please check the details and try again.'
      );
      expect(result.message).not.toContain('1234567890');
      expect(result.message).not.toContain('08012345678');
    });
  });

  describe('purchaseBill', () => {
    it('returns successful PurchaseResult', async () => {
      const mockResponse = {
        requestSuccessful: true,
        responseCode: '0',
        responseMessage: 'Transaction Completed Successfully',
        responseBody: {
          transactionReference: 'MON-TX-123',
          paymentReference: 'BACI-REF-123',
          status: 'PAID',
          token: 'TOKEN-1234',
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await purchaseBill(
        'IKEDC',
        'IKEDC-PREPAID',
        '12345678',
        2000,
        'JANE DOE',
        'BACI-REF-123',
        '08012345678',
        'VAL-123'
      );

      expect(result).toEqual({
        success: true,
        reference: 'BACI-REF-123',
        transactionId: 'MON-TX-123',
        pin: 'TOKEN-1234',
        message: 'Transaction Completed Successfully',
        status: 'successful',
        amount: 2000,
      });
    });

    it('honors vendStatus when status is missing', async () => {
      const mockResponse = {
        requestSuccessful: true,
        responseCode: '0',
        responseMessage: 'Completed',
        responseBody: {
          transactionReference: 'MON-TX-123',
          paymentReference: 'BACI-REF-123',
          vendStatus: 'SUCCESS',
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await purchaseBill(
        'IKEDC',
        'IKEDC-PREPAID',
        '12345678',
        2000,
        'JANE DOE',
        'BACI-REF-123',
        '08012345678',
        'VAL-123'
      );
      expect(result.status).toBe('successful');
      expect(result.success).toBe(true);
    });

    it('returns terminal failed status on business failure (requestSuccessful: false)', async () => {
      const mockResponse = {
        requestSuccessful: false,
        responseCode: '99',
        responseMessage: 'Insufficient Balance',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await purchaseBill(
        'IKEDC',
        'IKEDC-PREPAID',
        '12345678',
        2000,
        'JANE DOE',
        'BACI-REF-123'
      );
      expect(result.status).toBe('failed');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Insufficient Balance');
    });

    it('returns terminal failed status on HTTP 4xx API errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: vi.fn().mockResolvedValue(
          JSON.stringify({
            responseMessage:
              'Insufficient wallet balance for customer 08012345678',
          })
        ),
      });

      const result = await purchaseBill(
        'IKEDC',
        'IKEDC-PREPAID',
        '12345678',
        2000,
        'JANE DOE',
        'BACI-REF-123'
      );
      expect(result.status).toBe('failed');
      expect(result.success).toBe(false);
      expect(result.message).toBe(
        'Monnify rejected the bill payment request. Please verify the details and try again.'
      );
      expect(result.providerErrorDetail).toContain(
        'Monnify API error: 400 Bad Request - Insufficient wallet balance'
      );
      expect(result.providerErrorDetail).toContain('[redacted]');
      expect(result.providerErrorDetail).not.toContain('08012345678');
    });

    it('falls back to sanitized raw JSON when Monnify omits message fields', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: vi.fn().mockResolvedValue(
          JSON.stringify({
            errors: [{ field: 'customerId', value: '08012345678' }],
          })
        ),
      });

      const result = await purchaseBill(
        'IKEDC',
        'IKEDC-PREPAID',
        '12345678',
        2000,
        'JANE DOE',
        'BACI-REF-123'
      );

      expect(result.status).toBe('failed');
      expect(result.message).toContain('Monnify API error: 400 Bad Request -');
      expect(result.message).toContain('customerId');
      expect(result.message).toContain('[redacted]');
      expect(result.message).not.toContain('08012345678');
    });

    it('sanitizes plain-text HTTP error bodies before returning terminal 4xx failures', async () => {
      const longTail = 'x'.repeat(260);
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: vi
          .fn()
          .mockResolvedValue(
            `Plain error code 123456 customer 1234567 ${longTail} not-visible`
          ),
      });

      const result = await purchaseBill(
        'IKEDC',
        'IKEDC-PREPAID',
        '12345678',
        2000,
        'JANE DOE',
        'BACI-REF-123'
      );

      expect(result.status).toBe('failed');
      expect(result.message).toBe(
        'Monnify rejected the bill payment request. Please verify the details and try again.'
      );
      expect(result.providerErrorDetail).toContain(
        'Plain error code 123456 customer'
      );
      expect(result.providerErrorDetail).toContain('[redacted]');
      expect(result.providerErrorDetail).not.toContain('1234567');
      expect(result.providerErrorDetail).not.toContain('not-visible');
    });

    it('redacts sensitive digit sequences that cross the error detail boundary', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: vi.fn().mockResolvedValue(`${'x'.repeat(235)} 9876543 tail`),
      });

      const result = await purchaseBill(
        'IKEDC',
        'IKEDC-PREPAID',
        '12345678',
        2000,
        'JANE DOE',
        'BACI-REF-123'
      );

      expect(result.status).toBe('failed');
      expect(result.message).not.toContain('9876');
      expect(result.providerErrorDetail).not.toContain('9876');
      expect(result.providerErrorDetail).toContain('[red');
    });

    it('redacts sensitive digit sequences embedded next to letters and underscores', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: vi
          .fn()
          .mockResolvedValue(
            'Lookup failed for customer_08012345678 and id123456789'
          ),
      });

      const result = await purchaseBill(
        'IKEDC',
        'IKEDC-PREPAID',
        '12345678',
        2000,
        'JANE DOE',
        'BACI-REF-123'
      );

      expect(result.status).toBe('failed');
      expect(result.message).toContain('customer_[redacted]');
      expect(result.message).toContain('id[redacted]');
      expect(result.message).not.toContain('08012345678');
      expect(result.message).not.toContain('123456789');
    });

    it('throws a retryable transient error for timeouts, network issues, and HTTP 5xx before transactionReference is known', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });

      await expect(
        purchaseBill(
          'IKEDC',
          'IKEDC-PREPAID',
          '12345678',
          2000,
          'JANE DOE',
          'BACI-REF-123'
        )
      ).rejects.toThrow('Transient vend outcome');
    });

    it('does not abort vend requests at the old five second timeout', async () => {
      vi.useFakeTimers();
      try {
        const abortError = new Error('aborted');
        abortError.name = 'AbortError';
        let settled = false;

        global.fetch = vi.fn((_url, init?: RequestInit): Promise<Response> => {
          return new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(abortError);
            });
          });
        });

        const resultPromise = purchaseBill(
          'IKEDC',
          'IKEDC-PREPAID',
          '12345678',
          2000,
          'JANE DOE',
          'BACI-REF-123'
        )
          .then((result) => result)
          .catch((error: unknown) => error)
          .finally(() => {
            settled = true;
          });

        await Promise.resolve();
        expect(global.fetch).toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(5000);
        expect(settled).toBe(false);

        await vi.advanceTimersByTimeAsync(25_000);
        const result = await resultPromise;
        expect(result).toBeInstanceOf(Error);
        expect((result as Error).message).toContain('Transient vend outcome');
      } finally {
        vi.useRealTimers();
      }
    });

    it('throws a retryable transient error when processing response lacks transactionReference', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          requestSuccessful: true,
          responseCode: '0',
          responseMessage: 'Processing',
          responseBody: {
            vendStatus: 'IN_PROGRESS',
          },
        }),
      });

      await expect(
        purchaseBill(
          'IKEDC',
          'IKEDC-PREPAID',
          '12345678',
          2000,
          'JANE DOE',
          'BACI-REF-123'
        )
      ).rejects.toThrow('missing transactionReference');
    });
  });

  describe('checkTransactionStatus', () => {
    it('queries by transactionReference in URL and resolves success', async () => {
      const mockResponse = {
        requestSuccessful: true,
        responseCode: '0',
        responseMessage: 'success',
        responseBody: {
          transactionReference: 'MON-TX-123',
          status: 'PAID',
          token: 'TOKEN-1234',
        },
      };

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });
      global.fetch = fetchSpy;

      const result = await checkTransactionStatus('MON-TX-123');
      expect(result).toEqual({
        status: 'successful',
        message: 'success',
        pin: 'TOKEN-1234',
      });

      const lastFetchUrl = fetchSpy.mock.calls[0][0].toString();
      expect(lastFetchUrl).toContain('transactionReference=MON-TX-123');
      expect(lastFetchUrl).not.toContain('paymentReference=');
    });

    it('supports vendStatus when status is missing', async () => {
      const mockResponse = {
        requestSuccessful: true,
        responseCode: '0',
        responseMessage: 'success',
        responseBody: {
          transactionReference: 'MON-TX-123',
          vendStatus: 'SUCCESSFUL',
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await checkTransactionStatus('MON-TX-123');
      expect(result.status).toBe('successful');
    });

    it('fails closed for HTTP OK non-zero responseCode', async () => {
      const mockResponse = {
        requestSuccessful: true,
        responseCode: '1',
        responseMessage: 'Status lookup failed',
        responseBody: {
          transactionReference: 'MON-TX-123',
          vendStatus: 'SUCCESSFUL',
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await checkTransactionStatus('MON-TX-123');
      expect(result.status).toBe('failed');
      expect(result.message).toContain('Status lookup failed');
    });

    it('propagates/throws transient status check errors rather than failing row', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
      });

      await expect(checkTransactionStatus('MON-TX-123')).rejects.toThrow(
        'Monnify server error: 502'
      );
    });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Helper: build a mock Response
function mockResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
    json: vi.fn().mockResolvedValue(body),
  };
}

describe('agentic/paystack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  describe('createDedicatedVirtualAccount', () => {
    it('fails closed when PAYSTACK_SECRET_KEY is not set', async () => {
      vi.stubEnv('PAYSTACK_SECRET_KEY', '');

      // Re-import to pick up the env change
      vi.resetModules();
      const { createDedicatedVirtualAccount } = await import('./paystack');

      await expect(
        createDedicatedVirtualAccount(
          {
            email: 'test@example.com',
            first_name: 'John',
            last_name: 'Doe',
            phone: '+2348012345678',
          },
          { subaccount: 'ACCT_test123' }
        )
      ).rejects.toThrow('PAYSTACK_SECRET_KEY is not configured');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('creates customer then DVA with wema-bank as primary bank', async () => {
      vi.stubEnv('PAYSTACK_SECRET_KEY', 'sk_test_123');
      vi.resetModules();
      const { createDedicatedVirtualAccount } = await import('./paystack');

      mockFetch
        // 1. Create customer
        .mockResolvedValueOnce(
          mockResponse(200, {
            status: true,
            data: { customer_code: 'CUS_test123' },
          })
        )
        // 2. Create DVA (wema-bank)
        .mockResolvedValueOnce(
          mockResponse(200, {
            status: true,
            data: {
              account_number: '1234567890',
              account_name: 'MERCHANT/JOHN DOE',
              bank: { name: 'Wema Bank' },
              currency: 'NGN',
            },
          })
        );

      const result = await createDedicatedVirtualAccount(
        {
          email: 'john@test.com',
          first_name: 'John',
          last_name: 'Doe',
          phone: '+2348012345678',
        },
        { subaccount: 'ACCT_test123' }
      );

      expect(result.account_number).toBe('1234567890');
      expect(result.bank_name).toBe('Wema Bank');
      expect(result.account_name).toBe('MERCHANT/JOHN DOE');

      // Verify wema-bank was used (second fetch call)
      const dvaCall = mockFetch.mock.calls[1];
      const dvaBody = JSON.parse(dvaCall[1].body);
      expect(dvaBody.preferred_bank).toBe('wema-bank');
      expect(dvaBody.subaccount).toBe('ACCT_test123');
    });

    it('falls back to titan-paycom when wema-bank fails', async () => {
      vi.stubEnv('PAYSTACK_SECRET_KEY', 'sk_test_123');
      vi.resetModules();
      const { createDedicatedVirtualAccount } = await import('./paystack');

      mockFetch
        // 1. Create customer
        .mockResolvedValueOnce(
          mockResponse(200, {
            status: true,
            data: { customer_code: 'CUS_test456' },
          })
        )
        // 2. wema-bank fails
        .mockResolvedValueOnce(
          mockResponse(400, { message: 'Bank unavailable' })
        )
        // 3. titan-paycom succeeds
        .mockResolvedValueOnce(
          mockResponse(200, {
            status: true,
            data: {
              account_number: '9876543210',
              account_name: 'PAYSTACK-BIZ/JOHN DOE',
              bank: { name: 'Titan Paycom' },
              currency: 'NGN',
            },
          })
        );

      const result = await createDedicatedVirtualAccount(
        {
          email: 'john@test.com',
          first_name: 'John',
          last_name: 'Doe',
          phone: '',
        },
        { subaccount: 'ACCT_test123' }
      );

      expect(result.account_number).toBe('9876543210');
      expect(result.bank_name).toBe('Titan Paycom');
      expect(mockFetch).toHaveBeenCalledTimes(3);

      // Verify fallback: third call is titan-paycom
      const fallbackBody = JSON.parse(mockFetch.mock.calls[2][1].body);
      expect(fallbackBody.preferred_bank).toBe('titan-paycom');
      expect(fallbackBody.subaccount).toBe('ACCT_test123');
    });

    it('throws when both banks fail', async () => {
      vi.stubEnv('PAYSTACK_SECRET_KEY', 'sk_test_123');
      vi.resetModules();
      const { createDedicatedVirtualAccount } = await import('./paystack');

      mockFetch
        // 1. Create customer
        .mockResolvedValueOnce(
          mockResponse(200, {
            status: true,
            data: { customer_code: 'CUS_test789' },
          })
        )
        // 2. wema-bank fails
        .mockResolvedValueOnce(mockResponse(400, { message: 'Unavailable' }))
        // 3. titan-paycom also fails
        .mockResolvedValueOnce(
          mockResponse(400, { message: 'Also unavailable' })
        );

      await expect(
        createDedicatedVirtualAccount(
          {
            email: 'john@test.com',
            first_name: 'John',
            last_name: 'Doe',
            phone: '',
          },
          { subaccount: 'ACCT_test123' }
        )
      ).rejects.toThrow('Paystack API Error 400');
    });

    it('uses assignment.bank_name when bank.name is missing', async () => {
      vi.stubEnv('PAYSTACK_SECRET_KEY', 'sk_test_123');
      vi.resetModules();
      const { createDedicatedVirtualAccount } = await import('./paystack');

      mockFetch
        .mockResolvedValueOnce(
          mockResponse(200, {
            status: true,
            data: { customer_code: 'CUS_alt' },
          })
        )
        .mockResolvedValueOnce(
          mockResponse(200, {
            status: true,
            data: {
              account_number: '5555555555',
              account_name: 'ALT/CUSTOMER',
              assignment: { bank_name: 'Titan Trust' },
              currency: 'NGN',
            },
          })
        );

      const result = await createDedicatedVirtualAccount(
        {
          email: 'alt@test.com',
          first_name: 'Alt',
          last_name: 'Customer',
          phone: '',
        },
        { subaccount: 'ACCT_test123' }
      );

      expect(result.bank_name).toBe('Titan Trust');
    });

    it('fails closed when the merchant Paystack subaccount is invalid', async () => {
      vi.stubEnv('PAYSTACK_SECRET_KEY', 'sk_test_123');
      vi.resetModules();
      const { createDedicatedVirtualAccount } = await import('./paystack');

      await expect(
        createDedicatedVirtualAccount(
          {
            email: 'john@test.com',
            first_name: 'John',
            last_name: 'Doe',
            phone: '+2348012345678',
          },
          { subaccount: '' }
        )
      ).rejects.toThrow('Paystack subaccount is not configured');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('getOrCreatePaystackCustomer', () => {
    it('fetches existing customer when create returns duplicate', async () => {
      vi.stubEnv('PAYSTACK_SECRET_KEY', 'sk_test_123');
      vi.resetModules();
      const { getOrCreatePaystackCustomer } = await import('./paystack');

      mockFetch
        // Create returns non-ok but parseable (duplicate scenario via 200 with status: false)
        .mockResolvedValueOnce(
          mockResponse(200, {
            status: false,
            message: 'Duplicate entry for email',
          })
        )
        // Fetch by email succeeds
        .mockResolvedValueOnce(
          mockResponse(200, {
            status: true,
            data: { customer_code: 'CUS_existing' },
          })
        );

      const code = await getOrCreatePaystackCustomer({
        email: 'existing@test.com',
        first_name: 'Test',
        last_name: 'User',
        phone: '',
      });

      expect(code).toBe('CUS_existing');
    });

    it('rejects invalid email formats', async () => {
      vi.stubEnv('PAYSTACK_SECRET_KEY', 'sk_test_123');
      vi.resetModules();
      const { getOrCreatePaystackCustomer } = await import('./paystack');

      await expect(
        getOrCreatePaystackCustomer({
          email: 'not-an-email',
          first_name: 'Bad',
          last_name: 'Email',
          phone: '',
        })
      ).rejects.toThrow('Invalid email format');
    });

    it('rejects emails with path traversal characters', async () => {
      vi.stubEnv('PAYSTACK_SECRET_KEY', 'sk_test_123');
      vi.resetModules();
      const { getOrCreatePaystackCustomer } = await import('./paystack');

      await expect(
        getOrCreatePaystackCustomer({
          email: 'user/../admin@test.com',
          first_name: 'Bad',
          last_name: 'Path',
          phone: '',
        })
      ).rejects.toThrow('Email contains invalid characters');
    });
  });
});

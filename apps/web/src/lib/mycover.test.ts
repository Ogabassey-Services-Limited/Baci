import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMyCoverClient,
  estimateInsurancePremium,
  MyCoverClient,
  MyCoverError,
} from '@/lib/mycover';

// ---------------------------------------------------------------------------
// These tests describe the POST-migration (v2) behaviour of the MyCover client.
// They are written in a TDD "red" phase and will FAIL against the current v1
// implementation. After the migration they must all pass.
// ---------------------------------------------------------------------------

const SECRET_KEY = 'test-secret-key';

function mockFetchJson(body: unknown, status = 200) {
  return vi.spyOn(global, 'fetch').mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
}

function mockFetchError(body: unknown, status: number) {
  return vi.spyOn(global, 'fetch').mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => body,
  } as Response);
}

describe('MyCoverClient (v2)', () => {
  let client: MyCoverClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new MyCoverClient({ secretKey: SECRET_KEY });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Base URL
  // -----------------------------------------------------------------------
  describe('base URL', () => {
    it('sends requests to the v2 base URL', async () => {
      const spy = mockFetchJson({ responseCode: 200, data: {} });

      await client.getWalletBalance();

      const calledUrl = spy.mock.calls[0][0] as string;
      expect(calledUrl).toMatch(/^https:\/\/v2\.api\.mycover\.ai\/v2/);
    });

    it('does NOT use the v1 base URL', async () => {
      const spy = mockFetchJson({ responseCode: 200, data: {} });

      await client.getWalletBalance();

      const calledUrl = spy.mock.calls[0][0] as string;
      expect(calledUrl).not.toContain('api.mycover.ai/v1');
    });
  });

  // -----------------------------------------------------------------------
  // purchaseGadgetInsurance – v2 endpoint & field names
  // -----------------------------------------------------------------------
  describe('purchaseGadgetInsurance()', () => {
    const v2GadgetParams = {
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@example.com',
      phone_number: '2348012345678',
      address: '1 Lagos Road',
      gender: 'Female' as const,
      date_of_birth: '1990-01-01',
      occupation: 'Engineer',
      title: 'Ms',
      model_number: 'A2894',
      device_type: 'Phone' as const,
      device_make: 'Apple',
      device_model: 'iPhone 15',
      device_color: 'Black',
      imei_one: '123456789012345',
      id_image_url: 'https://example.com/id.jpg',
      product_id: 'prod_123',
      // v2 field names ------------------------------------------------
      value: 500_000,
      serial_number: 'SN-12345',
      device_purchase_date: '2025-12-01',
      image_url: 'https://example.com/device.jpg',
    };

    const v2PolicyResponse = {
      responseCode: 200,
      responseText: 'Success',
      data: {
        id: 'pol_abc',
        policy_number: 'POL-001',
        status: 'active',
        certificate_url: 'https://mycover.ai/cert/pol_abc.pdf',
        amount: 7500,
        is_active: true,
        start_date: '2026-04-09',
        expiration_date: '2027-04-09',
      },
    };

    it('POSTs to /products/buy (not the v1 gadget endpoint)', async () => {
      const spy = mockFetchJson(v2PolicyResponse);

      await client.purchaseGadgetInsurance(v2GadgetParams);

      const calledUrl = spy.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/products/buy');
      expect(calledUrl).not.toContain('/products/sti/buy-gadget-cover');
    });

    it('sends v2 field names in the request body', async () => {
      const spy = mockFetchJson(v2PolicyResponse);

      await client.purchaseGadgetInsurance(v2GadgetParams);

      const body = JSON.parse(spy.mock.calls[0][1]?.body as string);
      // v2 fields present
      expect(body).toHaveProperty('value', 500_000);
      expect(body).toHaveProperty('serial_number', 'SN-12345');
      expect(body).toHaveProperty('device_purchase_date', '2025-12-01');
      expect(body).toHaveProperty(
        'image_url',
        'https://example.com/device.jpg'
      );
      // v1 fields NOT present
      expect(body).not.toHaveProperty('device_value');
      expect(body).not.toHaveProperty('device_serial_number');
      expect(body).not.toHaveProperty('date_of_purchase');
      expect(body).not.toHaveProperty('device_about_image_url');
    });

    it('returns v2 response shape with certificate_url, amount, is_active', async () => {
      mockFetchJson(v2PolicyResponse);

      const result = await client.purchaseGadgetInsurance(v2GadgetParams);

      expect(result).toHaveProperty(
        'certificate_url',
        'https://mycover.ai/cert/pol_abc.pdf'
      );
      expect(result).toHaveProperty('amount', 7500);
      expect(result).toHaveProperty('is_active', true);
    });

    it('does NOT return v1 price fields (genius_price, market_price)', async () => {
      mockFetchJson(v2PolicyResponse);

      const result = await client.purchaseGadgetInsurance(v2GadgetParams);

      expect(result).not.toHaveProperty('genius_price');
      expect(result).not.toHaveProperty('market_price');
    });
  });

  // -----------------------------------------------------------------------
  // purchaseShippingInsurance – should NOT exist in v2
  // -----------------------------------------------------------------------
  describe('purchaseShippingInsurance()', () => {
    it('should NOT exist on the client (removed in v2)', () => {
      expect(client).not.toHaveProperty('purchaseShippingInsurance');
    });
  });

  // -----------------------------------------------------------------------
  // getPolicy – v2 response shape
  // -----------------------------------------------------------------------
  describe('getPolicy()', () => {
    it('returns a policy with v2 fields', async () => {
      const v2Policy = {
        responseCode: 200,
        responseText: 'Success',
        data: {
          id: 'pol_xyz',
          policy_number: 'POL-002',
          status: 'active',
          certificate_url: 'https://mycover.ai/cert/pol_xyz.pdf',
          amount: 5000,
          is_active: true,
          start_date: '2026-01-01',
          expiration_date: '2027-01-01',
        },
      };
      mockFetchJson(v2Policy);

      const result = await client.getPolicy('pol_xyz');

      expect(result.id).toBe('pol_xyz');
      expect(result).toHaveProperty('certificate_url');
      expect(result).toHaveProperty('amount');
      expect(result).toHaveProperty('is_active');
    });
  });

  // -----------------------------------------------------------------------
  // getClaims – v2 response shape: { total_result, claims }
  // -----------------------------------------------------------------------
  describe('getClaims()', () => {
    it('returns { total_result, claims } from v2 API', async () => {
      const v2ClaimsResponse = {
        responseCode: 200,
        responseText: 'Success',
        data: {
          total_result: 2,
          claims: [
            { id: 'clm_1', status: 'pending' },
            { id: 'clm_2', status: 'approved' },
          ],
        },
      };
      mockFetchJson(v2ClaimsResponse);

      const result = await client.getClaims();

      expect(result).toEqual({
        total_result: 2,
        claims: [
          { id: 'clm_1', status: 'pending' },
          { id: 'clm_2', status: 'approved' },
        ],
      });
    });
  });

  // -----------------------------------------------------------------------
  // getClaimById – new in v2
  // -----------------------------------------------------------------------
  describe('getClaimById()', () => {
    it('exists as a method on the client', () => {
      expect(typeof client.getClaimById).toBe('function');
    });

    it('fetches a single claim by ID', async () => {
      const claimResponse = {
        responseCode: 200,
        responseText: 'Success',
        data: { id: 'clm_1', status: 'approved', amount: 50_000 },
      };
      mockFetchJson(claimResponse);

      const result = await client.getClaimById('clm_1');

      expect(result).toEqual({
        id: 'clm_1',
        status: 'approved',
        amount: 50_000,
      });
    });
  });

  // -----------------------------------------------------------------------
  // getProductById – new in v2
  // -----------------------------------------------------------------------
  describe('getProductById()', () => {
    it('exists as a method on the client', () => {
      expect(typeof client.getProductById).toBe('function');
    });

    it('fetches a single product by ID', async () => {
      const productResponse = {
        responseCode: 200,
        responseText: 'Success',
        data: { id: 'prod_123', name: 'Gadget Cover', category: 'device' },
      };
      mockFetchJson(productResponse);

      const result = await client.getProductById('prod_123');

      expect(result).toEqual({
        id: 'prod_123',
        name: 'Gadget Cover',
        category: 'device',
      });
    });
  });

  // -----------------------------------------------------------------------
  // listProducts – new in v2
  // -----------------------------------------------------------------------
  describe('listProducts()', () => {
    it('exists as a method on the client', () => {
      expect(typeof client.listProducts).toBe('function');
    });

    it('lists products optionally filtered by categoryId', async () => {
      const productsResponse = {
        responseCode: 200,
        responseText: 'Success',
        data: [
          { id: 'prod_1', name: 'Gadget Cover' },
          { id: 'prod_2', name: 'Screen Cover' },
        ],
      };
      const spy = mockFetchJson(productsResponse);

      const result = await client.listProducts('cat_device');

      expect(result).toHaveLength(2);
      const calledUrl = spy.mock.calls[0][0] as string;
      expect(calledUrl).toContain('cat_device');
    });
  });

  // -----------------------------------------------------------------------
  // Error handling
  // -----------------------------------------------------------------------
  describe('error handling', () => {
    it('throws MyCoverError on non-OK response', async () => {
      mockFetchError({ responseText: 'Unauthorized' }, 401);

      await expect(client.getWalletBalance()).rejects.toThrow(MyCoverError);
    });

    it('includes the HTTP status on the thrown error', async () => {
      mockFetchError({ responseText: 'Forbidden' }, 403);

      await expect(client.getWalletBalance()).rejects.toMatchObject({
        status: 403,
      });
    });
  });

  // -----------------------------------------------------------------------
  // Auth header
  // -----------------------------------------------------------------------
  describe('authorization', () => {
    it('sends Bearer token in Authorization header', async () => {
      const spy = mockFetchJson({ responseCode: 200, data: {} });

      await client.getWalletBalance();

      const headers = spy.mock.calls[0][1]?.headers as Record<string, string>;
      expect(headers.Authorization).toBe(`Bearer ${SECRET_KEY}`);
    });
  });
});

// ---------------------------------------------------------------------------
// estimateInsurancePremium
// ---------------------------------------------------------------------------
describe('estimateInsurancePremium()', () => {
  it('returns an object with estimated and range fields', () => {
    const result = estimateInsurancePremium(100_000);

    expect(result).toHaveProperty('estimated');
    expect(result).toHaveProperty('range');
    expect(result.range).toHaveProperty('min');
    expect(result.range).toHaveProperty('max');
  });

  it('calculates 5% as the estimate (Gadget Cover V2 rate)', () => {
    const result = estimateInsurancePremium(100_000);
    expect(result.estimated).toBe(5_000);
  });

  it('range min and max are both 5%', () => {
    const result = estimateInsurancePremium(200_000);
    expect(result.range.min).toBe(10_000);
    expect(result.range.max).toBe(10_000);
  });

  it('rounds to nearest integer', () => {
    const result = estimateInsurancePremium(33_333);
    expect(Number.isInteger(result.estimated)).toBe(true);
    expect(Number.isInteger(result.range.min)).toBe(true);
    expect(Number.isInteger(result.range.max)).toBe(true);
  });

  /**
   * NOTE: estimateInsurancePremium is UX-only (for showing estimates before
   * purchase). The actual premium comes from the v2 API `amount` field in
   * the purchase response. This function does NOT call the API.
   */
  it('is a pure function (no API calls)', () => {
    const spy = vi.spyOn(global, 'fetch');
    estimateInsurancePremium(50_000);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// createMyCoverClient
// ---------------------------------------------------------------------------
describe('createMyCoverClient()', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns null when MYCOVER_SECRET_KEY is not set', () => {
    delete process.env.MYCOVER_SECRET_KEY;
    const client = createMyCoverClient();
    expect(client).toBeNull();
  });

  it('returns a MyCoverClient instance when MYCOVER_SECRET_KEY is set', () => {
    process.env.MYCOVER_SECRET_KEY = 'sk_test_123';
    const client = createMyCoverClient();
    expect(client).toBeInstanceOf(MyCoverClient);
  });
});

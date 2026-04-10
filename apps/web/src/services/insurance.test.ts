import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Mocks ----

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve({})),
}));

vi.mock('@/lib/phone', () => ({
  formatPhoneForMyCover: vi.fn((phone: string) => phone),
}));

const mockServerSupabase = {
  from: vi.fn(),
  auth: { getUser: vi.fn() },
};
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockServerSupabase),
}));

const mockPurchaseGadgetInsurance = vi.fn();
const mockGetClaims = vi.fn();
const mockCreateMyCoverClient = vi.fn();

vi.mock('@/lib/mycover', () => ({
  createMyCoverClient: () => mockCreateMyCoverClient(),
  MYCOVER_PRODUCTS: {
    'eec0711c-1e4a-453b-a26c-2726e0a1a7cc': {
      providerName: 'Sovereign Trust Insurance Plc',
      category: 'gadget',
    },
  },
}));

// Import after mocks
import { purchaseOrderInsurance, syncClaimsStatus } from './insurance';

// ---- Test Data ----

const VALID_ORDER_ID = 'order-123';
const VALID_MERCHANT_ID = 'merchant-456';

const mockDeviceDetails = {
  imei: '123456789012345',
  serialNumber: 'SN-ABC-123',
  deviceColor: 'Black',
  deviceModel: 'iPhone 15 Pro',
  deviceMake: 'Apple',
  deviceType: 'Phone' as const,
  deviceValue: 500000,
  purchaseDate: '2024-06-15',
  devicePhotos: {
    about: 'https://example.com/device-photo.jpg',
  },
};

const mockOrderWithInsurance = {
  id: VALID_ORDER_ID,
  merchant_id: VALID_MERCHANT_ID,
  customer_name: 'John Doe',
  customer_email: 'john@example.com',
  customer_phone: '+2348012345678',
  shipping_address: {
    address: '123 Main St',
    city: 'Lagos',
    state: 'Lagos',
  },
  order_items: [
    {
      id: 'item-1',
      name: 'iPhone 15 Pro',
      price: 500000,
      quantity: 1,
      has_assurance: true,
      assurance_fee: 5000,
    },
    {
      id: 'item-2',
      name: 'MacBook Pro',
      price: 1200000,
      quantity: 1,
      has_assurance: true,
      assurance_fee: 12000,
    },
  ],
};

const mockOrderWithoutInsurance = {
  ...mockOrderWithInsurance,
  order_items: [
    {
      id: 'item-1',
      name: 'iPhone 15 Pro',
      price: 500000,
      quantity: 1,
      has_assurance: false,
      assurance_fee: 0,
    },
  ],
};

// v2 MyCover response shape -- uses `amount` (string) instead of `genius_price` (number)
const mockMyCoverGadgetPolicy = {
  id: 'policy-gadget-001',
  policy_number: 'POL-GADGET-2024-001',
  purchase_id: 'purchase-gadget-abc',
  start_date: '2024-01-01',
  expiration_date: '2024-12-31',
  amount: '25000.0000',
  status: 'active',
  customer_id: 'cust-123',
  distributor_id: 'dist-456',
  certificate_url: 'https://mycover.ai/certificates/POL-GADGET-2024-001.pdf',
  product_id: 'mycover-gadget-product-id',
  provider_name: 'Sovereign Trust Insurance Plc',
};

// ---- Supabase mock helper ----

function orderSupabaseMock(
  orderData: unknown,
  insertSpy?: ReturnType<typeof vi.fn>
) {
  mockServerSupabase.from.mockImplementation((table: string) => {
    if (table === 'orders') {
      return {
        select: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve({
                data: orderData,
                error: orderData ? null : { message: 'Not found' },
              }),
          }),
        }),
      };
    }
    if (table === 'order_insurance_policies') {
      return {
        insert:
          insertSpy ?? vi.fn().mockResolvedValue({ data: {}, error: null }),
      };
    }
    return {};
  });
}

// ---- purchaseOrderInsurance (v2 gadget insurance) ----

describe('purchaseOrderInsurance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    orderSupabaseMock(mockOrderWithInsurance);
    mockCreateMyCoverClient.mockReturnValue({
      purchaseGadgetInsurance: mockPurchaseGadgetInsurance,
    });
    mockPurchaseGadgetInsurance.mockResolvedValue(mockMyCoverGadgetPolicy);
  });

  describe('v2 field names sent to MyCover API', () => {
    it('passes "value" instead of "device_value"', async () => {
      await purchaseOrderInsurance(VALID_ORDER_ID, mockDeviceDetails);
      expect(mockPurchaseGadgetInsurance).toHaveBeenCalledWith(
        expect.objectContaining({ value: mockDeviceDetails.deviceValue })
      );
      const args = mockPurchaseGadgetInsurance.mock.calls[0][0];
      expect(args).not.toHaveProperty('device_value');
    });

    it('passes "serial_number" instead of "device_serial_number"', async () => {
      await purchaseOrderInsurance(VALID_ORDER_ID, mockDeviceDetails);
      expect(mockPurchaseGadgetInsurance).toHaveBeenCalledWith(
        expect.objectContaining({
          serial_number: mockDeviceDetails.serialNumber,
        })
      );
      const args = mockPurchaseGadgetInsurance.mock.calls[0][0];
      expect(args).not.toHaveProperty('device_serial_number');
    });

    it('passes "device_purchase_date" instead of "date_of_purchase"', async () => {
      await purchaseOrderInsurance(VALID_ORDER_ID, mockDeviceDetails);
      expect(mockPurchaseGadgetInsurance).toHaveBeenCalledWith(
        expect.objectContaining({
          device_purchase_date: mockDeviceDetails.purchaseDate,
        })
      );
      const args = mockPurchaseGadgetInsurance.mock.calls[0][0];
      expect(args).not.toHaveProperty('date_of_purchase');
    });

    it('passes "image_url" instead of "device_about_image_url"', async () => {
      await purchaseOrderInsurance(VALID_ORDER_ID, mockDeviceDetails);
      expect(mockPurchaseGadgetInsurance).toHaveBeenCalledWith(
        expect.objectContaining({
          image_url: mockDeviceDetails.devicePhotos.about,
        })
      );
      const args = mockPurchaseGadgetInsurance.mock.calls[0][0];
      expect(args).not.toHaveProperty('device_about_image_url');
    });
  });

  describe('v2 DB persistence', () => {
    it('persists policy_type as "gadget"', async () => {
      const spy = vi.fn().mockResolvedValue({ data: {}, error: null });
      orderSupabaseMock(mockOrderWithInsurance, spy);
      await purchaseOrderInsurance(VALID_ORDER_ID, mockDeviceDetails);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ policy_type: 'gadget' })
      );
    });

    it('persists certificate_url from MyCover response', async () => {
      const spy = vi.fn().mockResolvedValue({ data: {}, error: null });
      orderSupabaseMock(mockOrderWithInsurance, spy);
      await purchaseOrderInsurance(VALID_ORDER_ID, mockDeviceDetails);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          certificate_url:
            'https://mycover.ai/certificates/POL-GADGET-2024-001.pdf',
        })
      );
    });

    it('persists provider_name from static config', async () => {
      const spy = vi.fn().mockResolvedValue({ data: {}, error: null });
      orderSupabaseMock(mockOrderWithInsurance, spy);
      await purchaseOrderInsurance(VALID_ORDER_ID, mockDeviceDetails);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          provider_name: 'Sovereign Trust Insurance Plc',
        })
      );
    });

    it('persists mycover_product_id', async () => {
      const spy = vi.fn().mockResolvedValue({ data: {}, error: null });
      orderSupabaseMock(mockOrderWithInsurance, spy);
      await purchaseOrderInsurance(VALID_ORDER_ID, mockDeviceDetails);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ mycover_product_id: expect.any(String) })
      );
    });

    it('persists premium_amount from response amount string, not assurance_fee', async () => {
      const spy = vi.fn().mockResolvedValue({ data: {}, error: null });
      orderSupabaseMock(mockOrderWithInsurance, spy);
      await purchaseOrderInsurance(VALID_ORDER_ID, mockDeviceDetails);
      // v2: "25000.0000" -> 25000, NOT item.assurance_fee (5000)
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ premium_amount: 25000 })
      );
    });
  });

  describe('Error Handling', () => {
    it('throws when MyCover client is not configured', async () => {
      mockCreateMyCoverClient.mockReturnValue(null);
      await expect(
        purchaseOrderInsurance(VALID_ORDER_ID, mockDeviceDetails)
      ).rejects.toThrow(/MyCover/);
    });

    it('throws when order is not found', async () => {
      orderSupabaseMock(null);
      await expect(
        purchaseOrderInsurance(VALID_ORDER_ID, mockDeviceDetails)
      ).rejects.toThrow(/Order not found/);
    });

    it('returns failure when no items have assurance', async () => {
      orderSupabaseMock(mockOrderWithoutInsurance);
      const result = await purchaseOrderInsurance(
        VALID_ORDER_ID,
        mockDeviceDetails
      );
      expect(result).toEqual(expect.objectContaining({ success: false }));
    });
  });
});

// ---- syncClaimsStatus (v2 claim status mapping) ----

describe('syncClaimsStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateMyCoverClient.mockReturnValue({
      getClaims: mockGetClaims,
    });
  });

  it('returns failure when MyCover client is not configured', async () => {
    mockCreateMyCoverClient.mockReturnValue(null);

    const result = await syncClaimsStatus();

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        message: expect.stringContaining('config missing'),
      })
    );
  });

  describe('v2 claim status mapping', () => {
    // v2 defines 12 claim statuses. The sync function must map each to our local statuses.
    const v2ClaimStatuses = [
      'Documented',
      'Inspection submitted',
      'Offer sent',
      'Offer accepted',
      'Payment initiated',
      'Settled',
      'Declined',
      'Repair estimate submitted',
      'Approved',
      'Pending',
      'Processing',
      'Rejected',
    ];

    it('recognizes all 12 v2 claim status values without errors', async () => {
      const claims = v2ClaimStatuses.map((status, i) => ({
        id: `claim-${i}`,
        policy_id: `policy-${i}`,
        claim_status: status,
      }));

      mockGetClaims.mockResolvedValue({ claims });

      // Setup the server supabase to return matching local policies
      mockServerSupabase.from.mockImplementation((table: string) => {
        if (table === 'order_insurance_policies') {
          return {
            select: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: 'local-1',
                      status: 'active',
                      claim_status: null,
                    },
                    error: null,
                  }),
              }),
            }),
            update: () => ({
              eq: () => Promise.resolve({ data: {}, error: null }),
            }),
          };
        }
        return {};
      });

      const result = await syncClaimsStatus();

      expect(result.success).toBe(true);
    });

    it('maps "Documented" to "in_review" status', async () => {
      const claims = [
        { id: 'claim-1', policy_id: 'policy-1', claim_status: 'Documented' },
      ];
      mockGetClaims.mockResolvedValue({ claims });

      const updateSpy = vi.fn().mockReturnValue({
        eq: () => Promise.resolve({ data: {}, error: null }),
      });

      mockServerSupabase.from.mockImplementation((table: string) => {
        if (table === 'order_insurance_policies') {
          return {
            select: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: 'local-1',
                      status: 'active',
                      claim_status: null,
                    },
                    error: null,
                  }),
              }),
            }),
            update: updateSpy,
          };
        }
        return {};
      });

      await syncClaimsStatus();

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          claim_status: 'in_review',
        })
      );
    });

    it('maps "Inspection submitted" to "in_review" status', async () => {
      const claims = [
        {
          id: 'claim-1',
          policy_id: 'policy-1',
          claim_status: 'Inspection submitted',
        },
      ];
      mockGetClaims.mockResolvedValue({ claims });

      const updateSpy = vi.fn().mockReturnValue({
        eq: () => Promise.resolve({ data: {}, error: null }),
      });

      mockServerSupabase.from.mockImplementation((table: string) => {
        if (table === 'order_insurance_policies') {
          return {
            select: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: 'local-1',
                      status: 'active',
                      claim_status: null,
                    },
                    error: null,
                  }),
              }),
            }),
            update: updateSpy,
          };
        }
        return {};
      });

      await syncClaimsStatus();

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          claim_status: 'in_review',
        })
      );
    });

    it('maps "Offer sent" to "in_review" status', async () => {
      const claims = [
        { id: 'claim-1', policy_id: 'policy-1', claim_status: 'Offer sent' },
      ];
      mockGetClaims.mockResolvedValue({ claims });

      const updateSpy = vi.fn().mockReturnValue({
        eq: () => Promise.resolve({ data: {}, error: null }),
      });

      mockServerSupabase.from.mockImplementation((table: string) => {
        if (table === 'order_insurance_policies') {
          return {
            select: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: 'local-1',
                      status: 'active',
                      claim_status: null,
                    },
                    error: null,
                  }),
              }),
            }),
            update: updateSpy,
          };
        }
        return {};
      });

      await syncClaimsStatus();

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          claim_status: 'in_review',
        })
      );
    });

    it('maps "Offer accepted" to "in_review" status', async () => {
      const claims = [
        {
          id: 'claim-1',
          policy_id: 'policy-1',
          claim_status: 'Offer accepted',
        },
      ];
      mockGetClaims.mockResolvedValue({ claims });

      const updateSpy = vi.fn().mockReturnValue({
        eq: () => Promise.resolve({ data: {}, error: null }),
      });

      mockServerSupabase.from.mockImplementation((table: string) => {
        if (table === 'order_insurance_policies') {
          return {
            select: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: 'local-1',
                      status: 'active',
                      claim_status: null,
                    },
                    error: null,
                  }),
              }),
            }),
            update: updateSpy,
          };
        }
        return {};
      });

      await syncClaimsStatus();

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          claim_status: 'in_review',
        })
      );
    });

    it('maps "Payment initiated" to "approved" status', async () => {
      const claims = [
        {
          id: 'claim-1',
          policy_id: 'policy-1',
          claim_status: 'Payment initiated',
        },
      ];
      mockGetClaims.mockResolvedValue({ claims });

      const updateSpy = vi.fn().mockReturnValue({
        eq: () => Promise.resolve({ data: {}, error: null }),
      });

      mockServerSupabase.from.mockImplementation((table: string) => {
        if (table === 'order_insurance_policies') {
          return {
            select: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: 'local-1',
                      status: 'active',
                      claim_status: null,
                    },
                    error: null,
                  }),
              }),
            }),
            update: updateSpy,
          };
        }
        return {};
      });

      await syncClaimsStatus();

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          claim_status: 'approved',
        })
      );
    });

    it('maps "Settled" to "approved" status', async () => {
      const claims = [
        { id: 'claim-1', policy_id: 'policy-1', claim_status: 'Settled' },
      ];
      mockGetClaims.mockResolvedValue({ claims });

      const updateSpy = vi.fn().mockReturnValue({
        eq: () => Promise.resolve({ data: {}, error: null }),
      });

      mockServerSupabase.from.mockImplementation((table: string) => {
        if (table === 'order_insurance_policies') {
          return {
            select: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: 'local-1',
                      status: 'active',
                      claim_status: null,
                    },
                    error: null,
                  }),
              }),
            }),
            update: updateSpy,
          };
        }
        return {};
      });

      await syncClaimsStatus();

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          claim_status: 'approved',
        })
      );
    });

    it('maps "Declined" to "rejected" status', async () => {
      const claims = [
        { id: 'claim-1', policy_id: 'policy-1', claim_status: 'Declined' },
      ];
      mockGetClaims.mockResolvedValue({ claims });

      const updateSpy = vi.fn().mockReturnValue({
        eq: () => Promise.resolve({ data: {}, error: null }),
      });

      mockServerSupabase.from.mockImplementation((table: string) => {
        if (table === 'order_insurance_policies') {
          return {
            select: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: 'local-1',
                      status: 'active',
                      claim_status: null,
                    },
                    error: null,
                  }),
              }),
            }),
            update: updateSpy,
          };
        }
        return {};
      });

      await syncClaimsStatus();

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          claim_status: 'rejected',
        })
      );
    });

    it('maps "Repair estimate submitted" to "in_review" status', async () => {
      const claims = [
        {
          id: 'claim-1',
          policy_id: 'policy-1',
          claim_status: 'Repair estimate submitted',
        },
      ];
      mockGetClaims.mockResolvedValue({ claims });

      const updateSpy = vi.fn().mockReturnValue({
        eq: () => Promise.resolve({ data: {}, error: null }),
      });

      mockServerSupabase.from.mockImplementation((table: string) => {
        if (table === 'order_insurance_policies') {
          return {
            select: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: 'local-1',
                      status: 'active',
                      claim_status: null,
                    },
                    error: null,
                  }),
              }),
            }),
            update: updateSpy,
          };
        }
        return {};
      });

      await syncClaimsStatus();

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          claim_status: 'in_review',
        })
      );
    });
  });
});

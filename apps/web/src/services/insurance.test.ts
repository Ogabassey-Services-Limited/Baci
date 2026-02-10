import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Mocks ----

// Mock logger to prevent console output during tests
vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock MyCover client
const mockPurchaseShippingInsurance = vi.fn();
const mockCreateMyCoverClient = vi.fn();

vi.mock('@/lib/mycover', () => ({
  createMyCoverClient: () => mockCreateMyCoverClient(),
}));

import { logger } from '@/lib/logger';
// Import after mocks
import { purchaseInsuranceForPaidOrder } from './insurance';

// ---- Test Data ----

const VALID_ORDER_ID = 'order-123';
const VALID_MERCHANT_ID = 'merchant-456';

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

const mockOrderMixedItems = {
  ...mockOrderWithInsurance,
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
      name: 'Phone Case',
      price: 5000,
      quantity: 2,
      has_assurance: false,
      assurance_fee: 0,
    },
  ],
};

const mockMyCoverPolicy = {
  id: 'policy-789',
  policy_number: 'POL-2024-001',
  purchase_id: 'purchase-abc',
  start_date: '2024-01-01',
  expiration_date: '2024-12-31',
  genius_price: 17000,
  status: 'active',
  customer_id: 'cust-123',
  distributor_id: 'dist-456',
  market_price: 20000,
};

// ---- Supabase Mock ----

let mockOrderResult: { data: unknown; error: unknown };
let mockExistingPolicyResult: { data: unknown; error: unknown };
let mockInsertResult: { data: unknown; error: unknown };

function createMockSupabase(): SupabaseClient {
  return {
    from: (table: string) => {
      if (table === 'orders') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve(mockOrderResult),
            }),
          }),
        };
      }
      if (table === 'order_insurance_policies') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve(mockExistingPolicyResult),
            }),
          }),
          insert: () => Promise.resolve(mockInsertResult),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: null }),
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
        insert: () => Promise.resolve({ data: null, error: null }),
      };
    },
  } as unknown as SupabaseClient;
}

// ---- Tests ----

describe('purchaseInsuranceForPaidOrder', () => {
  let mockSupabase: SupabaseClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();

    // Default happy path
    mockOrderResult = { data: mockOrderWithInsurance, error: null };
    mockExistingPolicyResult = { data: null, error: null };
    mockInsertResult = { data: {}, error: null };

    mockCreateMyCoverClient.mockReturnValue({
      purchaseShippingInsurance: mockPurchaseShippingInsurance,
    });
    mockPurchaseShippingInsurance.mockResolvedValue(mockMyCoverPolicy);
  });

  describe('Early Returns', () => {
    it('returns early when MyCover client is not configured', async () => {
      mockCreateMyCoverClient.mockReturnValue(null);

      await purchaseInsuranceForPaidOrder(
        mockSupabase,
        VALID_ORDER_ID,
        VALID_MERCHANT_ID
      );

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('MyCover not configured'),
          orderId: VALID_ORDER_ID,
        })
      );
      expect(mockPurchaseShippingInsurance).not.toHaveBeenCalled();
    });

    it('returns early when order fetch fails', async () => {
      mockOrderResult = {
        data: null,
        error: { message: 'Order not found', code: '404' },
      };

      await purchaseInsuranceForPaidOrder(
        mockSupabase,
        VALID_ORDER_ID,
        VALID_MERCHANT_ID
      );

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Failed to fetch order'),
          orderId: VALID_ORDER_ID,
        })
      );
      expect(mockPurchaseShippingInsurance).not.toHaveBeenCalled();
    });

    it('returns early when order has no items', async () => {
      mockOrderResult = {
        data: { ...mockOrderWithInsurance, order_items: null },
        error: null,
      };

      await purchaseInsuranceForPaidOrder(
        mockSupabase,
        VALID_ORDER_ID,
        VALID_MERCHANT_ID
      );

      expect(mockPurchaseShippingInsurance).not.toHaveBeenCalled();
    });

    it('returns early when order has no insured items', async () => {
      mockOrderResult = { data: mockOrderWithoutInsurance, error: null };

      await purchaseInsuranceForPaidOrder(
        mockSupabase,
        VALID_ORDER_ID,
        VALID_MERCHANT_ID
      );

      expect(mockPurchaseShippingInsurance).not.toHaveBeenCalled();
    });

    it('returns early when policy already exists (idempotency)', async () => {
      mockExistingPolicyResult = {
        data: { id: 'existing-policy-123' },
        error: null,
      };

      await purchaseInsuranceForPaidOrder(
        mockSupabase,
        VALID_ORDER_ID,
        VALID_MERCHANT_ID
      );

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Policy already exists'),
          orderId: VALID_ORDER_ID,
        })
      );
      expect(mockPurchaseShippingInsurance).not.toHaveBeenCalled();
    });
  });

  describe('Successful Purchase', () => {
    it('purchases insurance with correct customer details', async () => {
      await purchaseInsuranceForPaidOrder(
        mockSupabase,
        VALID_ORDER_ID,
        VALID_MERCHANT_ID
      );

      expect(mockPurchaseShippingInsurance).toHaveBeenCalledWith(
        expect.objectContaining({
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          phone_number: '+2348012345678',
        })
      );
    });

    it('handles customer name with single word (no last name)', async () => {
      mockOrderResult = {
        data: { ...mockOrderWithInsurance, customer_name: 'John' },
        error: null,
      };

      await purchaseInsuranceForPaidOrder(
        mockSupabase,
        VALID_ORDER_ID,
        VALID_MERCHANT_ID
      );

      expect(mockPurchaseShippingInsurance).toHaveBeenCalledWith(
        expect.objectContaining({
          first_name: 'John',
          last_name: '.',
        })
      );
    });

    it('handles customer name with multiple words', async () => {
      mockOrderResult = {
        data: {
          ...mockOrderWithInsurance,
          customer_name: 'John Michael Doe',
        },
        error: null,
      };

      await purchaseInsuranceForPaidOrder(
        mockSupabase,
        VALID_ORDER_ID,
        VALID_MERCHANT_ID
      );

      expect(mockPurchaseShippingInsurance).toHaveBeenCalledWith(
        expect.objectContaining({
          first_name: 'John',
          last_name: 'Michael Doe',
        })
      );
    });

    it('constructs delivery address from shipping details', async () => {
      await purchaseInsuranceForPaidOrder(
        mockSupabase,
        VALID_ORDER_ID,
        VALID_MERCHANT_ID
      );

      expect(mockPurchaseShippingInsurance).toHaveBeenCalledWith(
        expect.objectContaining({
          address: '123 Main St, Lagos, Lagos',
          drop_off_location: '123 Main St, Lagos, Lagos',
        })
      );
    });

    it('uses fallback address when shipping address is null', async () => {
      mockOrderResult = {
        data: { ...mockOrderWithInsurance, shipping_address: null },
        error: null,
      };

      await purchaseInsuranceForPaidOrder(
        mockSupabase,
        VALID_ORDER_ID,
        VALID_MERCHANT_ID
      );

      expect(mockPurchaseShippingInsurance).toHaveBeenCalledWith(
        expect.objectContaining({
          address: 'Nigeria',
          drop_off_location: 'Nigeria',
        })
      );
    });

    it('uses fallback address when shipping address fields are empty', async () => {
      mockOrderResult = {
        data: { ...mockOrderWithInsurance, shipping_address: {} },
        error: null,
      };

      await purchaseInsuranceForPaidOrder(
        mockSupabase,
        VALID_ORDER_ID,
        VALID_MERCHANT_ID
      );

      expect(mockPurchaseShippingInsurance).toHaveBeenCalledWith(
        expect.objectContaining({
          address: 'Nigeria',
          drop_off_location: 'Nigeria',
        })
      );
    });

    it('calculates total insured value correctly', async () => {
      await purchaseInsuranceForPaidOrder(
        mockSupabase,
        VALID_ORDER_ID,
        VALID_MERCHANT_ID
      );

      // item-1: 500000 * 1 = 500000
      // item-2: 1200000 * 1 = 1200000
      // Total: 1700000
      expect(mockPurchaseShippingInsurance).toHaveBeenCalledWith(
        expect.objectContaining({
          item_value: 1700000,
        })
      );
    });

    it('handles items with quantity > 1', async () => {
      mockOrderResult = {
        data: {
          ...mockOrderWithInsurance,
          order_items: [
            {
              id: 'item-1',
              name: 'Phone Case',
              price: 5000,
              quantity: 3,
              has_assurance: true,
              assurance_fee: 150,
            },
          ],
        },
        error: null,
      };

      await purchaseInsuranceForPaidOrder(
        mockSupabase,
        VALID_ORDER_ID,
        VALID_MERCHANT_ID
      );

      // 5000 * 3 = 15000
      expect(mockPurchaseShippingInsurance).toHaveBeenCalledWith(
        expect.objectContaining({
          item_value: 15000,
          item_details: [
            {
              description: 'Phone Case',
              value: 15000,
              quantity: 3,
            },
          ],
        })
      );
    });

    it('only includes insured items in calculations (mixed items)', async () => {
      mockOrderResult = { data: mockOrderMixedItems, error: null };

      await purchaseInsuranceForPaidOrder(
        mockSupabase,
        VALID_ORDER_ID,
        VALID_MERCHANT_ID
      );

      // Only item-1 is insured: 500000 * 1 = 500000
      expect(mockPurchaseShippingInsurance).toHaveBeenCalledWith(
        expect.objectContaining({
          item_value: 500000,
          item_details: [
            {
              description: 'iPhone 15 Pro',
              value: 500000,
              quantity: 1,
            },
          ],
        })
      );
    });

    it('constructs item details array correctly', async () => {
      await purchaseInsuranceForPaidOrder(
        mockSupabase,
        VALID_ORDER_ID,
        VALID_MERCHANT_ID
      );

      expect(mockPurchaseShippingInsurance).toHaveBeenCalledWith(
        expect.objectContaining({
          item_details: [
            {
              description: 'iPhone 15 Pro',
              value: 500000,
              quantity: 1,
            },
            {
              description: 'MacBook Pro',
              value: 1200000,
              quantity: 1,
            },
          ],
        })
      );
    });

    it('includes default shipping parameters', async () => {
      await purchaseInsuranceForPaidOrder(
        mockSupabase,
        VALID_ORDER_ID,
        VALID_MERCHANT_ID
      );

      expect(mockPurchaseShippingInsurance).toHaveBeenCalledWith(
        expect.objectContaining({
          pickup_location: 'Lagos, Nigeria',
          vehicle_type: 'Car',
          shipping_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        })
      );
    });

    it('includes product_id when DEFAULT_GIT_PRODUCT_ID is set', async () => {
      const originalEnv = process.env.MYCOVER_GIT_PRODUCT_ID;
      process.env.MYCOVER_GIT_PRODUCT_ID = 'git-product-123';

      // Re-import to pick up env change
      vi.resetModules();
      const { purchaseInsuranceForPaidOrder: reimported } = await import(
        './insurance'
      );

      await reimported(mockSupabase, VALID_ORDER_ID, VALID_MERCHANT_ID);

      expect(mockPurchaseShippingInsurance).toHaveBeenCalledWith(
        expect.objectContaining({
          product_id: 'git-product-123',
        })
      );

      process.env.MYCOVER_GIT_PRODUCT_ID = originalEnv;
    });

    it('saves policy to database with correct data', async () => {
      const insertSpy = vi.fn().mockResolvedValue({ data: {}, error: null });
      mockSupabase.from = ((table: string) => {
        if (table === 'order_insurance_policies') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
            insert: insertSpy,
          };
        }
        if (table === 'orders') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve(mockOrderResult),
              }),
            }),
          };
        }
        return {};
      }) as never;

      await purchaseInsuranceForPaidOrder(
        mockSupabase,
        VALID_ORDER_ID,
        VALID_MERCHANT_ID
      );

      expect(insertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          order_id: VALID_ORDER_ID,
          merchant_id: VALID_MERCHANT_ID,
          mycover_policy_id: 'policy-789',
          mycover_policy_number: 'POL-2024-001',
          mycover_purchase_id: 'purchase-abc',
          coverage_amount: 1700000,
          premium_amount: 17000, // sum of assurance fees
          status: 'active',
          customer_name: 'John Doe',
          customer_email: 'john@example.com',
          customer_phone: '+2348012345678',
          policy_start_date: '2024-01-01',
          policy_expiry_date: '2024-12-31',
        })
      );
    });

    it('logs success message with policy details', async () => {
      await purchaseInsuranceForPaidOrder(
        mockSupabase,
        VALID_ORDER_ID,
        VALID_MERCHANT_ID
      );

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('successfully'),
          orderId: VALID_ORDER_ID,
          policyNumber: 'POL-2024-001',
          premium: 17000,
          coverage: 1700000,
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('handles MyCover API errors gracefully without throwing', async () => {
      const myCoverError = new Error('MyCover API error: Insufficient funds');
      mockPurchaseShippingInsurance.mockRejectedValue(myCoverError);

      await expect(
        purchaseInsuranceForPaidOrder(
          mockSupabase,
          VALID_ORDER_ID,
          VALID_MERCHANT_ID
        )
      ).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Failed to purchase'),
          orderId: VALID_ORDER_ID,
          error: myCoverError,
        })
      );
    });

    it('handles database insert errors gracefully', async () => {
      const insertSpy = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Unique constraint violation', code: '23505' },
      });

      mockSupabase.from = ((table: string) => {
        if (table === 'order_insurance_policies') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
            insert: insertSpy,
          };
        }
        if (table === 'orders') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve(mockOrderResult),
              }),
            }),
          };
        }
        return {};
      }) as never;

      await purchaseInsuranceForPaidOrder(
        mockSupabase,
        VALID_ORDER_ID,
        VALID_MERCHANT_ID
      );

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('failed to save to DB'),
          orderId: VALID_ORDER_ID,
          policyId: 'policy-789',
        })
      );
    });

    it('continues execution after DB save error (does not throw)', async () => {
      const insertSpy = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'DB error' },
      });

      mockSupabase.from = ((table: string) => {
        if (table === 'order_insurance_policies') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
            insert: insertSpy,
          };
        }
        if (table === 'orders') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve(mockOrderResult),
              }),
            }),
          };
        }
        return {};
      }) as never;

      await expect(
        purchaseInsuranceForPaidOrder(
          mockSupabase,
          VALID_ORDER_ID,
          VALID_MERCHANT_ID
        )
      ).resolves.toBeUndefined();
    });

    it('handles missing customer email gracefully', async () => {
      mockOrderResult = {
        data: { ...mockOrderWithInsurance, customer_email: null },
        error: null,
      };

      await purchaseInsuranceForPaidOrder(
        mockSupabase,
        VALID_ORDER_ID,
        VALID_MERCHANT_ID
      );

      expect(mockPurchaseShippingInsurance).toHaveBeenCalledWith(
        expect.objectContaining({
          email: '',
        })
      );
    });

    it('handles missing customer phone gracefully', async () => {
      mockOrderResult = {
        data: { ...mockOrderWithInsurance, customer_phone: null },
        error: null,
      };

      await purchaseInsuranceForPaidOrder(
        mockSupabase,
        VALID_ORDER_ID,
        VALID_MERCHANT_ID
      );

      expect(mockPurchaseShippingInsurance).toHaveBeenCalledWith(
        expect.objectContaining({
          phone_number: '',
        })
      );
    });

    it('handles missing customer name gracefully', async () => {
      mockOrderResult = {
        data: { ...mockOrderWithInsurance, customer_name: null },
        error: null,
      };

      await purchaseInsuranceForPaidOrder(
        mockSupabase,
        VALID_ORDER_ID,
        VALID_MERCHANT_ID
      );

      expect(mockPurchaseShippingInsurance).toHaveBeenCalledWith(
        expect.objectContaining({
          first_name: 'Customer',
          last_name: '.',
        })
      );
    });
  });

  describe('Edge Cases', () => {
    it('handles items with missing quantity (defaults to 1)', async () => {
      mockOrderResult = {
        data: {
          ...mockOrderWithInsurance,
          order_items: [
            {
              id: 'item-1',
              name: 'Product',
              price: 10000,
              quantity: undefined,
              has_assurance: true,
              assurance_fee: 100,
            },
          ],
        },
        error: null,
      };

      await purchaseInsuranceForPaidOrder(
        mockSupabase,
        VALID_ORDER_ID,
        VALID_MERCHANT_ID
      );

      expect(mockPurchaseShippingInsurance).toHaveBeenCalledWith(
        expect.objectContaining({
          item_value: 10000,
          item_details: [
            {
              description: 'Product',
              value: 10000,
              quantity: 1,
            },
          ],
        })
      );
    });

    it('handles items with zero assurance fee', async () => {
      mockOrderResult = {
        data: {
          ...mockOrderWithInsurance,
          order_items: [
            {
              id: 'item-1',
              name: 'Product',
              price: 10000,
              quantity: 1,
              has_assurance: true,
              assurance_fee: 0,
            },
          ],
        },
        error: null,
      };

      await purchaseInsuranceForPaidOrder(
        mockSupabase,
        VALID_ORDER_ID,
        VALID_MERCHANT_ID
      );

      const insertSpy = vi.fn().mockResolvedValue({ data: {}, error: null });
      mockSupabase.from = ((table: string) => {
        if (table === 'order_insurance_policies') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
            insert: insertSpy,
          };
        }
        if (table === 'orders') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve(mockOrderResult),
              }),
            }),
          };
        }
        return {};
      }) as never;

      await purchaseInsuranceForPaidOrder(
        mockSupabase,
        VALID_ORDER_ID,
        VALID_MERCHANT_ID
      );

      // Should still proceed with premium_amount = 0
      expect(mockPurchaseShippingInsurance).toHaveBeenCalled();
    });

    it('handles empty order_items array', async () => {
      mockOrderResult = {
        data: { ...mockOrderWithInsurance, order_items: [] },
        error: null,
      };

      await purchaseInsuranceForPaidOrder(
        mockSupabase,
        VALID_ORDER_ID,
        VALID_MERCHANT_ID
      );

      expect(mockPurchaseShippingInsurance).not.toHaveBeenCalled();
    });

    it('generates correct shipping_date in YYYY-MM-DD format', async () => {
      const mockDate = new Date('2024-06-15T10:30:00Z');
      vi.setSystemTime(mockDate);

      await purchaseInsuranceForPaidOrder(
        mockSupabase,
        VALID_ORDER_ID,
        VALID_MERCHANT_ID
      );

      expect(mockPurchaseShippingInsurance).toHaveBeenCalledWith(
        expect.objectContaining({
          shipping_date: '2024-06-15',
        })
      );

      vi.useRealTimers();
    });
  });
});

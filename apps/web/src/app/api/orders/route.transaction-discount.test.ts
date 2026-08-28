import { beforeEach, describe, expect, it } from 'vitest';
import {
  createOrderRequest,
  getLatestRpc,
  POST,
  resetOrderRouteMocks,
} from './route.transaction-discount-fixtures.test';

describe('POST /api/orders transaction discount metadata', () => {
  beforeEach(() => {
    resetOrderRouteMocks();
  });

  it('persists mobile negotiated line discounts when expected_total is omitted', async () => {
    const request = createOrderRequest();

    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(getLatestRpc()).toHaveBeenCalledWith(
      'create_storefront_order',
      expect.objectContaining({
        p_discount_amount: 21.5,
        p_expected_total: null,
        p_source: 'mobile_app',
        p_tax_amount: 75,
        p_ad_tracking: expect.objectContaining({
          baci_transaction_discount: {
            lineDiscounts: [
              {
                lineId: 1,
                merchandiseDiscount: 20,
                productId: 'p-mac',
                vatRelief: 1.5,
                variantId: null,
              },
            ],
            proof: expect.objectContaining({
              action: 'storefront_transaction_discount',
              payload: expect.objectContaining({ version: 3 }),
            }),
            version: 3,
          },
        }),
      })
    );
  });
});

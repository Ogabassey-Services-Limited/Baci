import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const shippingHook = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/orders/useOrderGiglShipping', () => ({
  useOrderGiglShipping: shippingHook,
}));
vi.mock('@/lib/order-shipment', () => ({
  canUseSelectedShippingProvider: vi.fn(() => false),
  getOrderGiglInitialAddress: vi.fn(() => ({ address: '1 Allen' })),
}));

import { useOrderDetailsGiglShipping } from './useOrderDetailsGiglShipping';

describe('useOrderDetailsGiglShipping', () => {
  it('only enables the owner wallet flow during the shipment method step', () => {
    shippingHook.mockReturnValue({ quote: null });
    const order = {
      id: 'order-1',
      selected_quote_id: null,
      shipping_provider: null,
      shipping_funding_source: null,
    } as never;

    const { result } = renderHook(() =>
      useOrderDetailsGiglShipping({
        giglEligible: true,
        merchant: { user_id: 'owner-1' } as never,
        order,
        providerLabel: null,
        shipmentFlowStep: 'method',
        showShipmentFlow: true,
        userId: 'owner-1',
      })
    );

    expect(shippingHook).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true, orderId: 'order-1' })
    );
    expect(result.current.isMerchantOwner).toBe(true);
  });

  it('hides the wallet flow from non-owner staff', () => {
    shippingHook.mockReturnValue({ quote: { id: 'q' } });
    const { result } = renderHook(() =>
      useOrderDetailsGiglShipping({
        giglEligible: true,
        merchant: { user_id: 'owner-1' } as never,
        order: { id: 'order-1' } as never,
        providerLabel: null,
        shipmentFlowStep: 'method',
        showShipmentFlow: true,
        userId: 'staff-1',
      })
    );

    expect(result.current.isMerchantOwner).toBe(false);
    expect(result.current.giglShipping).toBeUndefined();
    expect(shippingHook).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false })
    );
  });
});

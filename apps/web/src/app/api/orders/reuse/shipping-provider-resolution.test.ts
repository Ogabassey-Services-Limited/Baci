import { describe, expect, it, vi } from 'vitest';
import type { OrderQuoteDestinationMismatchError } from '@/lib/shipping/order-quote-destination';
import {
  hasSelectedQuoteInput,
  normalizeShippingProvider,
  resolveSuppliedQuoteProvider,
} from './shipping-provider-resolution';

const baseInput = {
  order_id: '4dc0ee52-d9c4-406a-b6ca-80c84eef6a8f',
  merchant_id: 'e6e2e46c-5e3c-40c1-b0ae-832d6d20f0a2',
  tracking_token: 'tracking-token-123',
  customer_email: 'john@example.com',
  payment_method: 'card',
  shipping_provider: undefined,
};

describe('reuse shipping provider resolution', () => {
  it('normalizes blank providers to null', () => {
    expect(normalizeShippingProvider(undefined)).toBeNull();
    expect(normalizeShippingProvider(null)).toBeNull();
    expect(normalizeShippingProvider('   ')).toBeNull();
    expect(normalizeShippingProvider(' GIGL ')).toBe('GIGL');
  });

  it('detects whether the caller supplied selected_quote_id', () => {
    expect(hasSelectedQuoteInput(baseInput)).toBe(false);
    expect(
      hasSelectedQuoteInput({ ...baseInput, selected_quote_id: null })
    ).toBe(true);
  });

  it('resolves the provider from the supplied quote id', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { provider: ' GIGL ' },
      error: null,
    });

    await expect(
      resolveSuppliedQuoteProvider({ rpc } as never, {
        ...baseInput,
        selected_quote_id: '22222222-2222-4222-8222-222222222222',
      })
    ).resolves.toBe('GIGL');
    expect(rpc).toHaveBeenCalledWith('get_checkout_shipping_quote', {
      p_merchant_id: 'e6e2e46c-5e3c-40c1-b0ae-832d6d20f0a2',
      p_quote_id: '22222222-2222-4222-8222-222222222222',
    });
  });

  it('rejects supplied quote ids without a provider', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { provider: '' },
      error: null,
    });

    await expect(
      resolveSuppliedQuoteProvider({ rpc } as never, {
        ...baseInput,
        selected_quote_id: '22222222-2222-4222-8222-222222222222',
      })
    ).rejects.toMatchObject({
      code: 'INTERNATIONAL_QUOTE_PROVIDER_MISMATCH',
    } satisfies Partial<OrderQuoteDestinationMismatchError>);
  });
});

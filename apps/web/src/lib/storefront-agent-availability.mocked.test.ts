import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetEffectiveStock = vi.fn();

vi.mock('@/lib/product-stock', () => ({
  getEffectiveStock: (...args: unknown[]) => mockGetEffectiveStock(...args),
}));

beforeEach(() => {
  vi.resetModules();
  mockGetEffectiveStock.mockReset();
});

describe('storefront agent availability with controlled stock', () => {
  it('treats unmanaged inventory as untracked and purchasable', async () => {
    mockGetEffectiveStock.mockReturnValue(0);
    const { getStorefrontAgentAvailability } = await import(
      '@/lib/storefront-agent-availability'
    );
    const product = { manage_stock: false, stock: 0 };

    expect(getStorefrontAgentAvailability(product)).toEqual({
      availability: 'in_stock',
      inventory_policy: 'untracked',
      is_purchasable: true,
      quantity_available: null,
      stock: 0,
    });
    expect(mockGetEffectiveStock).toHaveBeenCalledWith(product);
  });

  it('treats managed positive effective stock as purchasable', async () => {
    mockGetEffectiveStock.mockReturnValue(8);
    const { getStorefrontAgentAvailability } = await import(
      '@/lib/storefront-agent-availability'
    );
    const product = { manage_stock: true, stock: 8 };

    expect(getStorefrontAgentAvailability(product)).toEqual({
      availability: 'in_stock',
      inventory_policy: 'tracked',
      is_purchasable: true,
      quantity_available: 8,
      stock: 8,
    });
    expect(mockGetEffectiveStock).toHaveBeenCalledWith(product);
  });

  it('treats managed non-positive effective stock as not purchasable', async () => {
    mockGetEffectiveStock.mockReturnValue(0);
    const { getStorefrontAgentAvailability } = await import(
      '@/lib/storefront-agent-availability'
    );
    const product = { manage_stock: true, stock: 0 };

    expect(getStorefrontAgentAvailability(product)).toEqual({
      availability: 'out_of_stock',
      inventory_policy: 'tracked',
      is_purchasable: false,
      quantity_available: 0,
      stock: 0,
    });
    expect(mockGetEffectiveStock).toHaveBeenCalledWith(product);
  });

  it('treats managed negative effective stock as not purchasable', async () => {
    mockGetEffectiveStock.mockReturnValue(-5);
    const { getStorefrontAgentAvailability } = await import(
      '@/lib/storefront-agent-availability'
    );
    const product = { manage_stock: true, stock: -5 };

    expect(getStorefrontAgentAvailability(product)).toEqual({
      availability: 'out_of_stock',
      inventory_policy: 'tracked',
      is_purchasable: false,
      quantity_available: 0,
      stock: -5,
    });
    expect(mockGetEffectiveStock).toHaveBeenCalledWith(product);
  });

  it('preserves very large effective stock values', async () => {
    mockGetEffectiveStock.mockReturnValue(Number.MAX_SAFE_INTEGER);
    const { getStorefrontAgentAvailability } = await import(
      '@/lib/storefront-agent-availability'
    );
    const product = {
      manage_stock: true,
      stock: Number.MAX_SAFE_INTEGER,
    };

    expect(getStorefrontAgentAvailability(product)).toEqual({
      availability: 'in_stock',
      inventory_policy: 'tracked',
      is_purchasable: true,
      quantity_available: Number.MAX_SAFE_INTEGER,
      stock: Number.MAX_SAFE_INTEGER,
    });
    expect(mockGetEffectiveStock).toHaveBeenCalledWith(product);
  });

  it('uses the effective stock result for nullish raw stock input', async () => {
    mockGetEffectiveStock.mockReturnValue(0);
    const { getStorefrontAgentAvailability } = await import(
      '@/lib/storefront-agent-availability'
    );
    const product = { manage_stock: true, stock: null, stock_quantity: null };

    expect(getStorefrontAgentAvailability(product)).toEqual({
      availability: 'out_of_stock',
      inventory_policy: 'tracked',
      is_purchasable: false,
      quantity_available: 0,
      stock: 0,
    });
    expect(mockGetEffectiveStock).toHaveBeenCalledWith(product);
  });

  it('propagates effective stock calculation failures', async () => {
    const error = new Error('stock calculation failed');
    mockGetEffectiveStock.mockImplementation(() => {
      throw error;
    });
    const { getStorefrontAgentAvailability } = await import(
      '@/lib/storefront-agent-availability'
    );

    expect(() =>
      getStorefrontAgentAvailability({ manage_stock: true, stock: 'bad' })
    ).toThrow(error);
  });
});

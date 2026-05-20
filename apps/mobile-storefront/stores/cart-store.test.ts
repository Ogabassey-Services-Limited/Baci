import { jest } from '@jest/globals';

jest.mock('../lib/storage', () => ({
  syncStorage: {
    getItem: jest.fn(() => null),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

import { resetCartLineSequence, useCartStore } from './cart-store';

const { syncStorage } =
  require('../lib/storage') as typeof import('../lib/storage');

describe('cart-store', () => {
  beforeEach(() => {
    resetCartLineSequence();
    useCartStore.setState({ items: [], isLoading: false, lineSequence: 0 });
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('refreshes image and variant metadata when the same cart line is added again', () => {
    const { addItem } = useCartStore.getState();

    addItem({
      product_id: 'product-1',
      slug: 'redmi-note-14',
      variant_id: 'variant-128',
      name: 'Redmi Note 14',
      price: 220000,
      quantity: 1,
      image_url: undefined,
      color: undefined,
      storage: '128GB',
      condition: 'New',
    });

    addItem({
      product_id: 'product-1',
      slug: 'redmi-note-14',
      variant_id: 'variant-128',
      variant_attributes: {
        color: 'Midnight Black',
        storage: '128GB',
      },
      name: 'Redmi Note 14',
      price: 220000,
      quantity: 1,
      image_url: 'https://cdn.example.com/redmi-note-14-black.jpg',
      color: 'Midnight Black',
      storage: '128GB',
      condition: 'New',
      variant_name: '128GB / Midnight Black',
    });

    const [item] = useCartStore.getState().items;

    expect(item).toMatchObject({
      product_id: 'product-1',
      variant_id: 'variant-128',
      quantity: 2,
      image_url: 'https://cdn.example.com/redmi-note-14-black.jpg',
      color: 'Midnight Black',
      storage: '128GB',
      variant_name: '128GB / Midnight Black',
      variant_attributes: {
        color: 'Midnight Black',
        storage: '128GB',
      },
    });
  });

  it('keeps voucher awards as separate zero-price cart lines for the same SKU', () => {
    const { addItem } = useCartStore.getState();

    addItem({
      product_id: 'product-1',
      slug: 'redmi-note-14',
      variant_id: 'variant-128',
      name: 'Redmi Note 14',
      price: 220000,
      quantity: 2,
      color: 'Midnight Black',
      storage: '128GB',
      condition: 'New',
    });

    const firstVoucherItem = {
      product_id: 'product-1',
      slug: 'redmi-note-14',
      variant_id: 'variant-128',
      name: 'Redmi Note 14',
      price: 0,
      quantity: 3,
      color: 'Midnight Black',
      storage: '128GB',
      condition: 'New',
      voucher_token: 'voucher-token-1',
      voucher_award_id: 'voucher-award-1',
    };

    const secondVoucherItem = {
      ...firstVoucherItem,
      voucher_token: 'voucher-token-2',
      voucher_award_id: 'voucher-award-2',
    };

    addItem(firstVoucherItem);
    addItem(secondVoucherItem);

    const items = useCartStore.getState().items;

    expect(items).toHaveLength(3);
    expect(new Set(items.map((item) => item.id)).size).toBe(3);

    const paidLine = items.find((item) => item.price === 220000);
    expect(paidLine).toMatchObject({
      product_id: 'product-1',
      variant_id: 'variant-128',
      price: 220000,
      quantity: 2,
    });
    expect(paidLine).not.toHaveProperty('voucher_token');
    expect(paidLine).not.toHaveProperty('voucher_award_id');

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          price: 0,
          quantity: 1,
          voucher_token: 'voucher-token-1',
          voucher_award_id: 'voucher-award-1',
        }),
        expect.objectContaining({
          price: 0,
          quantity: 1,
          voucher_token: 'voucher-token-2',
          voucher_award_id: 'voucher-award-2',
        }),
      ])
    );
  });

  it('keeps token-only voucher cart lines separate from paid SKU lines', () => {
    const { addItem } = useCartStore.getState();

    addItem({
      product_id: 'product-1',
      slug: 'redmi-note-14',
      variant_id: 'variant-128',
      name: 'Redmi Note 14',
      price: 220000,
      quantity: 1,
      color: 'Midnight Black',
      storage: '128GB',
      condition: 'New',
    });

    addItem({
      product_id: 'product-1',
      slug: 'redmi-note-14',
      variant_id: 'variant-128',
      name: 'Redmi Note 14',
      price: 0,
      quantity: 4,
      color: 'Midnight Black',
      storage: '128GB',
      condition: 'New',
      voucher_token: 'voucher-token-only',
    });

    const items = useCartStore.getState().items;

    expect(items).toHaveLength(2);
    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ price: 220000, quantity: 1 }),
        expect.objectContaining({
          price: 0,
          quantity: 1,
          voucher_token: 'voucher-token-only',
        }),
      ])
    );
  });

  it('resets generated voucher line ids for deterministic test isolation', () => {
    const { addItem } = useCartStore.getState();

    addItem({
      product_id: 'product-1',
      slug: 'redmi-note-14',
      variant_id: 'variant-128',
      name: 'Redmi Note 14',
      price: 0,
      quantity: 1,
      voucher_award_id: 'voucher-award-1',
    });

    const firstId = useCartStore.getState().items[0]?.id;
    resetCartLineSequence();
    useCartStore.setState({ items: [], isLoading: false, lineSequence: 0 });

    addItem({
      product_id: 'product-1',
      slug: 'redmi-note-14',
      variant_id: 'variant-128',
      name: 'Redmi Note 14',
      price: 0,
      quantity: 1,
      voucher_award_id: 'voucher-award-1',
    });

    expect(useCartStore.getState().items[0]?.id).toBe(firstId);
  });

  it('persists the generated line sequence with cart items', () => {
    const { addItem } = useCartStore.getState();

    addItem({
      product_id: 'product-1',
      slug: 'redmi-note-14',
      variant_id: 'variant-128',
      name: 'Redmi Note 14',
      price: 0,
      quantity: 1,
      voucher_award_id: 'voucher-award-1',
    });

    const lastPayload = jest.mocked(syncStorage.setItem).mock.calls.at(-1)?.[1];

    expect(lastPayload).toEqual(expect.any(String));
    expect(JSON.parse(lastPayload as string)).toMatchObject({
      state: {
        lineSequence: 1,
      },
    });
  });

  it('does not reset generated line ids while cart items still exist', () => {
    const { addItem } = useCartStore.getState();

    addItem({
      product_id: 'product-1',
      slug: 'redmi-note-14',
      variant_id: 'variant-128',
      name: 'Redmi Note 14',
      price: 0,
      quantity: 1,
      voucher_award_id: 'voucher-award-1',
    });

    resetCartLineSequence();

    addItem({
      product_id: 'product-1',
      slug: 'redmi-note-14',
      variant_id: 'variant-128',
      name: 'Redmi Note 14',
      price: 0,
      quantity: 1,
      voucher_award_id: 'voucher-award-1',
    });

    const ids = useCartStore.getState().items.map((item) => item.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });
});

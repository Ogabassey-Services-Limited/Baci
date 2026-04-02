jest.mock('../lib/storage', () => ({
  syncStorage: {
    getItem: jest.fn(() => null),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

import { useCartStore } from './cart-store';

describe('cart-store', () => {
  beforeEach(() => {
    useCartStore.setState({ items: [], isLoading: false });
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
});

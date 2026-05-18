import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../lib/storage', () => ({
  syncStorage: {
    getItem: jest.fn(() => null),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

import { useSavedStore } from './saved-store';

describe('saved-store', () => {
  beforeEach(() => {
    useSavedStore.setState({
      items: [],
      toastState: { show: false, message: '', type: 'add' },
    });
  });

  it('preserves variant selection metadata when saving SKU-matrix products', () => {
    useSavedStore.getState().addItem({
      id: 'iphone-15',
      name: 'iPhone 15',
      slug: 'iphone-15',
      price: 900000,
      image: 'https://example.com/iphone-15.jpg',
      has_variants: true,
      variant_model: 'sku_matrix',
      available_conditions: ['open_box', 'used'],
      has_condition_offers: true,
    });

    const [item] = useSavedStore.getState().items;

    expect(item).toMatchObject({
      product_id: 'iphone-15',
      has_variants: true,
      variant_model: 'sku_matrix',
      available_conditions: ['open_box', 'used'],
      has_condition_offers: true,
    });
  });
});

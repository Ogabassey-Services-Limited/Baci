import { useCartStore } from '@/stores/cart-store';

describe('cart-store', () => {
  beforeEach(() => {
    useCartStore.setState({ items: [], isLoading: false });
  });

  it('keeps condition-specific cart lines distinct during lookup', () => {
    const store = useCartStore.getState();

    store.addItem({
      product_id: 'product-1',
      slug: 'iphone-16',
      variant_id: 'variant-1',
      name: 'iPhone 16',
      price: 1000000,
      quantity: 1,
      selected_attributes: {
        storage: '128GB',
      },
      condition: 'new',
    });

    store.addItem({
      product_id: 'product-1',
      slug: 'iphone-16',
      variant_id: 'variant-1',
      name: 'iPhone 16',
      price: 900000,
      quantity: 1,
      selected_attributes: {
        storage: '128GB',
      },
      condition: 'used',
    });

    const currentStore = useCartStore.getState();
    const newItem = currentStore.getItem(
      'product-1',
      {
        variantId: 'variant-1',
        selectedAttributes: { storage: '128GB' },
        condition: 'new',
      }
    );
    const usedItem = currentStore.getItem(
      'product-1',
      {
        variantId: 'variant-1',
        selectedAttributes: { storage: '128GB' },
        condition: 'used',
      }
    );

    expect(currentStore.items).toHaveLength(2);
    expect(newItem).toBeDefined();
    expect(usedItem).toBeDefined();
    expect(newItem).not.toBe(usedItem);
    expect(newItem?.condition).toBe('new');
    expect(usedItem?.condition).toBe('used');
    expect(newItem?.price).toBe(1000000);
    expect(usedItem?.price).toBe(900000);
  });

  it('keeps empty-string variant keys distinct from nullish fallbacks', () => {
    const store = useCartStore.getState();

    store.addItem({
      product_id: 'product-1',
      slug: 'iphone-16',
      variant_id: '',
      name: 'iPhone 16',
      price: 1000000,
      quantity: 1,
      selected_attributes: {},
      condition: '',
    });

    store.addItem({
      product_id: 'product-1',
      slug: 'iphone-16',
      name: 'iPhone 16',
      price: 1000000,
      quantity: 1,
      selected_attributes: {},
    });

    const currentStore = useCartStore.getState();
    const emptyStringItem = currentStore.getItem('product-1', {
      condition: '',
      selectedAttributes: {},
      variantId: '',
    });
    const defaultItem = currentStore.getItem('product-1', {
      selectedAttributes: {},
    });

    expect(currentStore.items).toHaveLength(2);
    expect(emptyStringItem).toBeDefined();
    expect(defaultItem).toBeDefined();
    expect(emptyStringItem?.condition).toBe('');
    expect(emptyStringItem?.variant_id).toBe('');
    expect(defaultItem?.condition).toBeUndefined();
    expect(defaultItem?.variant_id).toBeUndefined();
    expect(emptyStringItem?.id).not.toBe(defaultItem?.id);
  });

  it('encodes cart id segments so separator-like values do not collide', () => {
    const store = useCartStore.getState();

    store.addItem({
      product_id: 'product::1',
      slug: 'iphone-16',
      variant_id: 'variant-1',
      name: 'iPhone 16',
      price: 1000000,
      quantity: 1,
      selected_attributes: { storage: '128GB' },
      condition: 'new',
    });

    store.addItem({
      product_id: 'product',
      slug: 'iphone-16',
      variant_id: '1::variant-1',
      name: 'iPhone 16',
      price: 1000000,
      quantity: 1,
      selected_attributes: { storage: '128GB' },
      condition: 'new',
    });

    const currentStore = useCartStore.getState();
    const [firstItem, secondItem] = currentStore.items;

    expect(currentStore.items).toHaveLength(2);
    expect(firstItem?.id).not.toBe(secondItem?.id);
    expect(firstItem?.id).toContain('product%3A%3A1');
    expect(secondItem?.id).toContain('1%3A%3Avariant-1');
  });
});

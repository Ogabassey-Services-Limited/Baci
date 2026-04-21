import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialProductEditFormData } from '@/components/product/product-edit.defaults';
import { createProductEditVariantActions } from './createProductEditVariantActions';

type VariantFormData = ReturnType<typeof createInitialProductEditFormData>;
type VariantSetter =
  | VariantFormData
  | ((previous: VariantFormData) => VariantFormData);

function createStore(initial: VariantFormData) {
  let formData = initial;
  const setFormData = vi.fn((updater: VariantSetter) => {
    formData = typeof updater === 'function' ? updater(formData) : updater;
  });
  return {
    get formData() {
      return formData;
    },
    setFormData,
  };
}

describe('createProductEditVariantActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adjusts stock and fulfillment rows together', () => {
    const store = createStore(createInitialProductEditFormData());

    const actions = createProductEditVariantActions({
      formData: store.formData,
      setFormData: store.setFormData,
    });

    actions.adjustStock(2);

    expect(store.formData.stock_quantity).toBe(2);
    expect(store.formData.fulfillment_details.items).toEqual([
      { imei: '', serial_number: '' },
      { imei: '', serial_number: '' },
    ]);
  });

  it('clears fulfillment items when adjustStock is called with zero', () => {
    const store = createStore({
      ...createInitialProductEditFormData(),
      fulfillment_details: {
        items: [
          { imei: 'a', serial_number: 'a' },
          { imei: 'b', serial_number: 'b' },
        ],
      },
      stock_quantity: 2,
    });

    const actions = createProductEditVariantActions({
      formData: store.formData,
      setFormData: store.setFormData,
    });

    actions.adjustStock(0);

    expect(store.formData.stock_quantity).toBe(0);
    expect(store.formData.fulfillment_details.items).toEqual([]);
  });

  it('floors stock at zero when adjustStock is called with a negative value', () => {
    const store = createStore({
      ...createInitialProductEditFormData(),
      fulfillment_details: {
        items: [{ imei: 'a', serial_number: 'a' }],
      },
      stock_quantity: 1,
    });

    const actions = createProductEditVariantActions({
      formData: store.formData,
      setFormData: store.setFormData,
    });

    actions.adjustStock(-5);

    expect(store.formData.stock_quantity).toBe(0);
    expect(store.formData.fulfillment_details.items).toEqual([]);
  });

  it('adds a new variant using the current default pricing', () => {
    const store = createStore({
      ...createInitialProductEditFormData(),
      cost_price: 500,
      price: 1000,
    });

    const actions = createProductEditVariantActions({
      formData: store.formData,
      setFormData: store.setFormData,
    });

    actions.addVariant();

    expect(store.formData.has_variants).toBe(true);
    expect(store.formData.variants).toHaveLength(1);
    expect(store.formData.variants[0].price).toBe(1000);
  });

  it('appends a variant when has_variants is already true', () => {
    const initial = {
      ...createInitialProductEditFormData(),
      cost_price: 200,
      has_variants: true,
      price: 400,
    };
    const store = createStore(initial);
    const actions = createProductEditVariantActions({
      formData: store.formData,
      setFormData: store.setFormData,
    });

    actions.addVariant();
    actions.addVariant();

    expect(store.formData.has_variants).toBe(true);
    expect(store.formData.variants).toHaveLength(2);
  });

  it('creates a variant with price zero when the base price is zero', () => {
    const store = createStore({
      ...createInitialProductEditFormData(),
      cost_price: 0,
      price: 0,
    });

    const actions = createProductEditVariantActions({
      formData: store.formData,
      setFormData: store.setFormData,
    });

    actions.addVariant();

    expect(store.formData.variants).toHaveLength(1);
    expect(store.formData.variants[0].price).toBe(0);
  });
});

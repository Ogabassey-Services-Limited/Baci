import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialProductEditFormData } from '@/components/product/product-edit.defaults';
import { createProductEditVariantActions } from './createProductEditVariantActions';

describe('createProductEditVariantActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adjusts stock and fulfillment rows together', () => {
    let formData = createInitialProductEditFormData();
    const setFormData = vi.fn((updater: typeof formData | ((previous: typeof formData) => typeof formData)) => {
      formData = typeof updater === 'function' ? updater(formData) : updater;
    });

    const actions = createProductEditVariantActions({
      formData,
      setFormData,
    });

    actions.adjustStock(2);

    expect(formData.stock_quantity).toBe(2);
    expect(formData.fulfillment_details.items).toEqual([
      { imei: '', serial_number: '' },
      { imei: '', serial_number: '' },
    ]);
  });

  it('adds a new variant using the current default pricing', () => {
    let formData = {
      ...createInitialProductEditFormData(),
      cost_price: 500,
      price: 1000,
    };
    const setFormData = vi.fn((updater: typeof formData | ((previous: typeof formData) => typeof formData)) => {
      formData = typeof updater === 'function' ? updater(formData) : updater;
    });

    const actions = createProductEditVariantActions({
      formData,
      setFormData,
    });

    actions.addVariant();

    expect(formData.has_variants).toBe(true);
    expect(formData.variants).toHaveLength(1);
    expect(formData.variants[0].price).toBe(1000);
  });
});

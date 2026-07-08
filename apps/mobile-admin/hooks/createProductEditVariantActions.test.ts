import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialProductEditFormData } from '@/components/product/product-edit.defaults';
import {
  createEmptyEditableVariant,
  createEmptyVariantAttribute,
} from '@/lib/product-variant-form';
import { createProductEditVariantActions } from './createProductEditVariantActions';

const cryptoState = vi.hoisted(() => ({
  counter: 0,
}));

vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(() => {
    cryptoState.counter += 1;
    return `fulfillment-item-${cryptoState.counter}`;
  }),
}));

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
    cryptoState.counter = 0;
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
      { id: 'fulfillment-item-1', imei: '', serial_number: '' },
      { id: 'fulfillment-item-2', imei: '', serial_number: '' },
    ]);
  });

  it('clears fulfillment items when adjustStock is called with zero', () => {
    const store = createStore({
      ...createInitialProductEditFormData(),
      fulfillment_details: {
        items: [
          { id: 'item-1', imei: 'a', serial_number: 'a' },
          { id: 'item-2', imei: 'b', serial_number: 'b' },
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
        items: [{ id: 'item-1', imei: 'a', serial_number: 'a' }],
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

  it('returns the created client id so callers can auto-expand the new row', () => {
    const store = createStore({
      ...createInitialProductEditFormData(),
      price: 1000,
    });
    const actions = createProductEditVariantActions({
      formData: store.formData,
      setFormData: store.setFormData,
    });

    const clientId = actions.addVariant();

    expect(typeof clientId).toBe('string');
    expect(clientId.length).toBeGreaterThan(0);
    expect(store.formData.variants[0].client_id).toBe(clientId);
  });

  it('adds a variant from the latest queued form state', () => {
    const store = createStore({
      ...createInitialProductEditFormData(),
      cost_price: 100,
      images: ['old.png'],
      price: 200,
      variants: [
        {
          ...createEmptyEditableVariant(),
          attributes: [createEmptyVariantAttribute('Color', 'Black')],
        },
      ],
    });
    const actions = createProductEditVariantActions({
      formData: store.formData,
      setFormData: store.setFormData,
    });

    store.setFormData((previous) => ({
      ...previous,
      cost_price: 900,
      images: ['new.png'],
      price: 1200,
      variants: [
        {
          ...createEmptyEditableVariant(),
          attributes: [createEmptyVariantAttribute('Storage', '128GB')],
          condition: 'used',
        },
      ],
    }));

    const clientId = actions.addVariant();
    const created = store.formData.variants.at(-1);

    expect(created).toMatchObject({
      client_id: clientId,
      condition: 'used',
      cost_price: 900,
      images: ['new.png'],
      price: 1200,
      primary_image: 'new.png',
    });
    expect(created?.attributes.map((attribute) => attribute.key)).toEqual([
      'Storage',
    ]);
  });

  it('generateVariants inherits parent images and drops placeholder rows', () => {
    const store = createStore({
      ...createInitialProductEditFormData(),
      has_variants: true,
      images: ['parent.png'],
      variants: [createEmptyEditableVariant()],
    });
    const actions = createProductEditVariantActions({
      formData: store.formData,
      setFormData: store.setFormData,
    });

    actions.generateVariants([
      {
        ...createEmptyEditableVariant(),
        attributes: [createEmptyVariantAttribute('Color', 'Black')],
      },
      {
        ...createEmptyEditableVariant(),
        attributes: [createEmptyVariantAttribute('Color', 'Blue')],
      },
    ]);

    // The untouched placeholder row is replaced by the two generated variants.
    expect(store.formData.variants).toHaveLength(2);
    for (const variant of store.formData.variants) {
      expect(variant.images).toEqual(['parent.png']);
      expect(variant.primary_image).toBe('parent.png');
    }
  });

  it('generateVariants skips duplicates already present in the form', () => {
    const existing = {
      ...createEmptyEditableVariant(),
      attributes: [createEmptyVariantAttribute('Color', 'Black')],
      sku: 'KEEP-1',
    };
    const store = createStore({
      ...createInitialProductEditFormData(),
      has_variants: true,
      variants: [existing],
    });
    const actions = createProductEditVariantActions({
      formData: store.formData,
      setFormData: store.setFormData,
    });

    actions.generateVariants([
      {
        ...createEmptyEditableVariant(),
        attributes: [createEmptyVariantAttribute('Color', 'Black')],
      },
      {
        ...createEmptyEditableVariant(),
        attributes: [createEmptyVariantAttribute('Color', 'Blue')],
      },
    ]);

    expect(store.formData.variants).toHaveLength(2);
    expect(store.formData.variants[0].sku).toBe('KEEP-1');
  });

  it('applyVariantPricing fans price and cost onto the targeted variants only', () => {
    const variants = [
      createEmptyEditableVariant({ costPrice: 100, price: 400 }),
      createEmptyEditableVariant({ costPrice: 100, price: 400 }),
      createEmptyEditableVariant({ costPrice: 100, price: 450 }),
    ];
    const store = createStore({
      ...createInitialProductEditFormData(),
      has_variants: true,
      variants,
    });
    const actions = createProductEditVariantActions({
      formData: store.formData,
      setFormData: store.setFormData,
    });

    actions.applyVariantPricing([
      { cost_price: 250, indexes: [0, 1], price: 500 },
    ]);

    expect(store.formData.variants[0]).toMatchObject({
      cost_price: 250,
      price: 500,
    });
    expect(store.formData.variants[1]).toMatchObject({
      cost_price: 250,
      price: 500,
    });
    expect(store.formData.variants[2]).toMatchObject({
      cost_price: 100,
      price: 450,
    });
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

  it('updates fulfillment items by stable id instead of array position', () => {
    const store = createStore({
      ...createInitialProductEditFormData(),
      fulfillment_details: {
        items: [
          { id: 'item-1', imei: '', serial_number: '' },
          { id: 'item-2', imei: '', serial_number: '' },
        ],
      },
    });

    const actions = createProductEditVariantActions({
      formData: store.formData,
      setFormData: store.setFormData,
    });

    actions.updateFulfillmentItem('item-2', 'imei', '99999');

    expect(store.formData.fulfillment_details.items).toEqual([
      { id: 'item-1', imei: '', serial_number: '' },
      { id: 'item-2', imei: '99999', serial_number: '' },
    ]);
  });
});

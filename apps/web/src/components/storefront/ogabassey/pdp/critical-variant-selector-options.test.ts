import { describe, expect, it } from 'vitest';
import {
  getAvailableCriticalVariantOptions,
  getRenderableCriticalVariantAxes,
  getVariantAxisOptions,
} from './critical-variant-selector-options';

describe('critical variant selector options', () => {
  it('keeps axes with visible options while filtering hidden axes', () => {
    expect(
      getRenderableCriticalVariantAxes(
        ['storage', 'ram', 'color', 'colour', 'colour_hex'],
        [
        {
          attributes: {
            color: 'Graphite',
            colour: 'Graphite',
            colour_hex: '#1f2937',
            ram: '4GB',
            storage: '128GB',
          },
          id: 'variant-128-4',
          merchant_id: 'merchant-1',
          product_id: 'product-1',
          stock_quantity: 10,
        },
        {
          attributes: {
            color: 'Graphite',
            colour: 'Graphite',
            colour_hex: '#1f2937',
            ram: '8GB',
            storage: '256GB',
          },
          id: 'variant-256-8',
          merchant_id: 'merchant-1',
          product_id: 'product-1',
          stock_quantity: 8,
        },
        ]
      )
    ).toEqual(['storage', 'ram']);
  });

  it('shows condition only when multiple SKU conditions exist', () => {
    expect(
      getRenderableCriticalVariantAxes(['condition', 'storage'], [
        {
          attributes: { storage: '128GB' },
          condition: 'used',
          id: 'variant-used',
          merchant_id: 'merchant-1',
          product_id: 'product-1',
          stock_quantity: 2,
        },
        {
          attributes: { storage: '128GB' },
          condition: 'new',
          id: 'variant-new',
          merchant_id: 'merchant-1',
          product_id: 'product-1',
          stock_quantity: 2,
        },
      ])
    ).toEqual(['condition', 'storage']);

    expect(
      getRenderableCriticalVariantAxes(['condition', 'storage'], [
        {
          attributes: { storage: '128GB' },
          condition: 'used',
          id: 'variant-used-a',
          merchant_id: 'merchant-1',
          product_id: 'product-1',
          stock_quantity: 2,
        },
        {
          attributes: { storage: '256GB' },
          condition: 'used',
          id: 'variant-used-b',
          merchant_id: 'merchant-1',
          product_id: 'product-1',
          stock_quantity: 2,
        },
      ])
    ).toEqual(['storage']);
  });

  it('keeps a single-option visible axis selected for display', () => {
    expect(
      getRenderableCriticalVariantAxes(['storage', 'color'], [
        {
          attributes: { color: 'Black', storage: '128GB' },
          id: 'variant-black',
          merchant_id: 'merchant-1',
          product_id: 'product-1',
          stock_quantity: 2,
        },
        {
          attributes: { color: 'Blue', storage: '128GB' },
          id: 'variant-blue',
          merchant_id: 'merchant-1',
          product_id: 'product-1',
          stock_quantity: 2,
        },
      ])
    ).toEqual(['storage']);
  });

  it('canonicalizes variant attribute keys before deciding visible axes', () => {
    expect(
      getRenderableCriticalVariantAxes(['Storage'], [
        {
          attributes: { Storage: '128GB' },
          id: 'variant-128',
          merchant_id: 'merchant-1',
          product_id: 'product-1',
          stock_quantity: 2,
        },
        {
          attributes: { Storage: '256GB' },
          id: 'variant-256',
          merchant_id: 'merchant-1',
          product_id: 'product-1',
          stock_quantity: 2,
        },
      ])
    ).toEqual(['storage']);
  });

  it('preserves metadata-only axes as renderable fallback options', () => {
    expect(
      getRenderableCriticalVariantAxes(
        ['storage'],
        [
          {
            attributes: {},
            id: 'variant-128',
            merchant_id: 'merchant-1',
            product_id: 'product-1',
            stock_quantity: 2,
          },
        ],
        { storage: ['128GB'] }
      )
    ).toEqual(['storage']);
    expect(getVariantAxisOptions([], 'storage', { storage: ['128GB'] })).toEqual(
      ['128GB']
    );
  });

  it('does not render multi-option metadata axes that no variant can resolve', () => {
    expect(
      getRenderableCriticalVariantAxes(
        ['storage'],
        [
          {
            attributes: {},
            id: 'variant-1',
            merchant_id: 'merchant-1',
            product_id: 'product-1',
            stock_quantity: 2,
          },
        ],
        { storage: ['128GB', '256GB'] }
      )
    ).toEqual([]);
    expect(
      getVariantAxisOptions([], 'storage', { storage: ['128GB', '256GB'] })
    ).toEqual([]);
  });

  it('does not fall back to impossible options for variant-backed axes', () => {
    expect(
      getAvailableCriticalVariantOptions(
        'storage',
        [
          {
            attributes: {},
            condition: 'used',
            id: 'variant-used',
            merchant_id: 'merchant-1',
            product_id: 'product-1',
            stock_quantity: 2,
          },
          {
            attributes: { storage: '256GB' },
            condition: 'new',
            id: 'variant-new-256',
            merchant_id: 'merchant-1',
            product_id: 'product-1',
            stock_quantity: 2,
          },
        ],
        { condition: 'used' },
        { storage: ['256GB'] }
      )
    ).toEqual([]);
  });

  it('keeps fallback options for metadata-only critical axes', () => {
    expect(
      getAvailableCriticalVariantOptions(
        'platform',
        [
          {
            attributes: { storage: '1TB' },
            id: 'variant-1tb',
            merchant_id: 'merchant-1',
            product_id: 'product-1',
            stock_quantity: 2,
          },
        ],
        {},
        { platform: ['PS5'] }
      )
    ).toEqual(['PS5']);
  });

  it('filters out non-variant metadata axes while preserving legitimate SKU dimensions', () => {
    const rawAxes = [
      'storage',
      'notebook_size',
      'extended_warranty',
      'availability_note',
      'warranty',
      'warranty_note',
      'disclaimer',
      'delivery_notice',
    ];
    const testVariants = [
      {
        attributes: {
          availability_note: 'Confirm price',
          delivery_notice: 'Ships fast',
          disclaimer: 'Final sale',
          extended_warranty: '2 Years',
          notebook_size: '16 inch',
          storage: '2TB',
          warranty: '1 Year',
          warranty_note: 'Parts only',
        },
        id: 'v1',
        merchant_id: 'm1',
        product_id: 'p1',
        stock_quantity: 10,
      },
    ];
    const variantAxisOptions = {
      availability_note: ['Confirm price'],
      delivery_notice: ['Ships fast'],
      disclaimer: ['Final sale'],
      extended_warranty: ['2 Years'],
      notebook_size: ['16 inch'],
      storage: ['2TB'],
      warranty: ['1 Year'],
      warranty_note: ['Parts only'],
    };

    const renderableVariantAxes = getRenderableCriticalVariantAxes(
      rawAxes,
      testVariants,
      variantAxisOptions
    );

    expect(renderableVariantAxes).toEqual(['storage', 'notebook_size', 'extended_warranty']);
    expect(renderableVariantAxes).not.toContain('availability_note');
    expect(renderableVariantAxes).not.toContain('warranty');
    expect(renderableVariantAxes).not.toContain('warranty_note');
    expect(renderableVariantAxes).not.toContain('disclaimer');
    expect(renderableVariantAxes).not.toContain('delivery_notice');
  });

  it('renders critical warranty axis as selectable when multiple warranty options exist', () => {
    const rawAxes = ['storage', 'warranty'];
    const testVariants = [
      { attributes: { storage: '2TB', warranty: '1 Year' }, id: 'v1', merchant_id: 'm1', product_id: 'p1', stock_quantity: 10 },
      { attributes: { storage: '2TB', warranty: '2 Years' }, id: 'v2', merchant_id: 'm1', product_id: 'p1', stock_quantity: 5 },
    ];

    const renderableVariantAxes = getRenderableCriticalVariantAxes(rawAxes, testVariants, {});

    expect(renderableVariantAxes).toEqual(['storage', 'warranty']);
  });
});

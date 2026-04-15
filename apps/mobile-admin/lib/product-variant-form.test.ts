import { describe, expect, it } from 'vitest';
import {
  buildParentVariantAttributes,
  buildVariantAttributeRecord,
  buildVariantFormValues,
  createEmptyEditableVariant,
  getLowestVariantPrice,
  getTotalVariantStock,
} from '@/lib/product-variant-form';

describe('product-variant-form', () => {
  it('maps admin product variants into editable form values', () => {
    const variants = buildVariantFormValues(
      [
        {
          condition: 'used',
          cost_price: 720000,
          has_variants: false,
          id: 'variant-1',
          images: ['https://example.com/variant-1.png'],
          name: 'iPhone 14 Pro 256GB',
          parent_product_id: 'product-1',
          price: 900000,
          primary_image: 'https://example.com/variant-1-primary.png',
          sku: 'IP14PRO-256',
          source: 'structured',
          stock_quantity: 4,
          variant_attributes: { storage: '256GB', color: 'Black' },
        },
      ],
      { costPrice: 700000, price: 850000 }
    );

    expect(variants).toEqual([
      {
        attributes: [
          expect.objectContaining({ key: 'storage', value: '256GB' }),
          expect.objectContaining({ key: 'color', value: 'Black' }),
        ],
        client_id: 'variant-1',
        condition: 'used',
        cost_price: 720000,
        id: 'variant-1',
        images: ['https://example.com/variant-1.png'],
        price: 900000,
        primary_image: 'https://example.com/variant-1-primary.png',
        sku: 'IP14PRO-256',
        stock_quantity: 4,
      },
    ]);
  });

  it('preserves normalized migrated variant conditions when building editable form values', () => {
    const variants = buildVariantFormValues(
      [
        {
          condition: 'UK Used',
          cost_price: 720000,
          has_variants: false,
          id: 'variant-invalid',
          images: [],
          name: 'Unknown condition variant',
          parent_product_id: 'product-2',
          price: 900000,
          primary_image: null,
          sku: 'INVALID',
          source: 'structured',
          stock_quantity: 1,
          variant_attributes: { storage: '256GB' },
        },
      ],
      { costPrice: 700000, price: 850000 }
    );

    expect(variants[0]?.condition).toBe('uk_used');
  });

  it('builds parent variant attribute summaries with unique values', () => {
    expect(
      buildParentVariantAttributes([
        {
          attributes: [
            { id: 'attribute-1', key: 'storage', value: '128GB' },
            { id: 'attribute-2', key: 'color', value: 'Black' },
          ],
        },
        {
          attributes: [
            { id: 'attribute-3', key: 'storage', value: '256GB' },
            { id: 'attribute-4', key: 'color', value: 'Black' },
          ],
        },
      ])
    ).toEqual({
      color: ['Black'],
      storage: ['128GB', '256GB'],
    });
  });

  it('builds a clean variant attribute record from editable rows', () => {
    expect(
      buildVariantAttributeRecord([
        { id: 'attribute-1', key: 'storage', value: '256GB' },
        { id: 'attribute-2', key: ' color ', value: ' Black ' },
        { id: 'attribute-3', key: 'empty', value: '   ' },
      ])
    ).toEqual({
      color: 'Black',
      storage: '256GB',
    });
  });

  it('creates empty variants with the provided defaults', () => {
    expect(
      createEmptyEditableVariant({
        attributeKeys: ['storage', 'color'],
        condition: 'new',
        costPrice: 200,
        images: ['https://example.com/default.png'],
        price: 500,
      })
    ).toEqual({
      attributes: [
        expect.objectContaining({ key: 'storage', value: '' }),
        expect.objectContaining({ key: 'color', value: '' }),
      ],
      client_id: expect.any(String),
      condition: 'new',
      cost_price: 200,
      images: ['https://example.com/default.png'],
      price: 500,
      primary_image: 'https://example.com/default.png',
      sku: '',
      stock_quantity: 0,
    });
  });

  it('derives the lowest variant price and total variant stock', () => {
    const variants = [
      {
        attributes: [],
        client_id: 'variant-1',
        cost_price: 0,
        images: [],
        price: 650,
        primary_image: null,
        sku: '',
        stock_quantity: 2,
      },
      {
        attributes: [],
        client_id: 'variant-2',
        cost_price: 0,
        images: [],
        price: 600,
        primary_image: null,
        sku: '',
        stock_quantity: 5,
      },
    ];

    expect(getLowestVariantPrice(variants, 999)).toBe(600);
    expect(getTotalVariantStock(variants)).toBe(7);
  });
});

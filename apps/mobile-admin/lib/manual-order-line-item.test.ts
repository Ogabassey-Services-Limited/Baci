import { describe, expect, it } from 'vitest';
import {
  buildManualOrderLineItem,
  type SelectableManualOrderProduct,
} from '@/lib/manual-order-line-item';

describe('buildManualOrderLineItem', () => {
  it('stores the parent product name separately from the variant label', () => {
    const product: SelectableManualOrderProduct = {
      condition: 'used',
      has_variants: false,
      id: 'variant_1',
      images: ['variant.jpg'],
      name: 'Apple AirPods Max 2 USB-C Space Gray / Used',
      parent_product_id: 'product_1',
      price: 828000,
      sku: 'APM2-USB-C-USED',
      variant_attributes: { color: 'Space Gray', condition: 'Used' },
    };

    expect(
      buildManualOrderLineItem({
        fallbackImageUrl: 'parent.jpg',
        parentProductName: 'Apple AirPods Max 2 USB-C',
        product,
      })
    ).toEqual({
      condition: 'used',
      id: 'product_1::variant_1',
      image_url: 'variant.jpg',
      name: 'Apple AirPods Max 2 USB-C',
      price: 828000,
      product_id: 'product_1',
      quantity: 1,
      variant_id: 'variant_1',
      variant_name: 'Space Gray / Used',
    });
  });

  it('keeps the product name unchanged for non-variant rows', () => {
    const product: SelectableManualOrderProduct = {
      condition: 'new',
      has_variants: false,
      id: 'product_2',
      images: [],
      name: 'PS5 Slim Console Cover',
      parent_product_id: null,
      price: 27366,
      sku: 'PS5-COVER',
      variant_attributes: null,
    };

    expect(
      buildManualOrderLineItem({
        fallbackImageUrl: 'parent.jpg',
        parentProductName: 'Ignored Parent',
        product,
      })
    ).toEqual({
      condition: 'new',
      id: 'product_2::base',
      image_url: 'parent.jpg',
      name: 'PS5 Slim Console Cover',
      price: 27366,
      product_id: 'product_2',
      quantity: 1,
      variant_id: null,
      variant_name: null,
    });
  });

  it('omits variant_name when the derived picker label matches the parent product name', () => {
    const product: SelectableManualOrderProduct = {
      condition: 'new',
      has_variants: false,
      id: 'variant_2',
      images: ['parent.jpg'],
      name: 'Sony WH-1000XM6',
      parent_product_id: 'product_3',
      price: 455000,
      sku: 'SONY-WH1000XM6',
      variant_attributes: null,
    };

    expect(
      buildManualOrderLineItem({
        fallbackImageUrl: 'fallback.jpg',
        parentProductName: 'Sony WH-1000XM6',
        product,
      })
    ).toEqual({
      condition: 'new',
      id: 'product_3::variant_2',
      image_url: 'parent.jpg',
      name: 'Sony WH-1000XM6',
      price: 455000,
      product_id: 'product_3',
      quantity: 1,
      variant_id: 'variant_2',
      variant_name: null,
    });
  });
});

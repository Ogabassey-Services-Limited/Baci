import { describe, expect, it, vi } from 'vitest';
import {
  extractOrderItemImage,
  loadOrderItemImageMap,
} from '@/app/dashboard/orders/order-item-images';

describe('extractOrderItemImage', () => {
  it('returns the first string image url', () => {
    expect(
      extractOrderItemImage([
        'https://cdn.example.com/products/iphone.avif',
        'https://cdn.example.com/products/iphone-2.avif',
      ])
    ).toBe('https://cdn.example.com/products/iphone.avif');
  });

  it('returns the first object image url', () => {
    expect(
      extractOrderItemImage([
        { url: 'https://cdn.example.com/products/ipad.avif' },
      ])
    ).toBe('https://cdn.example.com/products/ipad.avif');
  });

  it('returns undefined for unsupported image payloads', () => {
    expect(extractOrderItemImage(null)).toBeUndefined();
    expect(extractOrderItemImage([])).toBeUndefined();
    expect(extractOrderItemImage([{ src: 'missing' }])).toBeUndefined();
  });
});

describe('loadOrderItemImageMap', () => {
  it('loads a deduplicated map of product images', async () => {
    const inQuery = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'product-1',
          images: ['https://cdn.example.com/products/product-1.avif'],
        },
      ],
      error: null,
    });
    const selectQuery = vi.fn(() => ({ in: inQuery }));
    const supabase = {
      from: vi.fn(() => ({ select: selectQuery })),
    } as const;

    const imageMap = await loadOrderItemImageMap(supabase as never, [
      'product-1',
      'product-1',
      null,
    ]);

    expect(supabase.from).toHaveBeenCalledWith('products');
    expect(selectQuery).toHaveBeenCalledWith('id, images');
    expect(inQuery).toHaveBeenCalledWith('id', ['product-1']);
    expect(imageMap.get('product-1')).toBe(
      'https://cdn.example.com/products/product-1.avif'
    );
  });

  it('returns an empty map when there are no product ids', async () => {
    const supabase = {
      from: vi.fn(),
    } as const;

    const imageMap = await loadOrderItemImageMap(supabase as never, []);

    expect(imageMap.size).toBe(0);
    expect(supabase.from).not.toHaveBeenCalled();
  });
});

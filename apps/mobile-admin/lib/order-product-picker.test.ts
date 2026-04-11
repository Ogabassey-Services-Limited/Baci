import { describe, expect, it } from 'vitest';
import {
  getProductPickerRowSubtitle,
  getProductPickerRowTitle,
} from '@/lib/order-product-picker';

describe('getProductPickerRowTitle', () => {
  it('keeps the full title for parent products', () => {
    expect(getProductPickerRowTitle({ name: 'iPhone 14 Pro Max' }, null)).toBe(
      'iPhone 14 Pro Max'
    );
  });

  it('extracts the variant suffix when the name starts with the parent name', () => {
    expect(
      getProductPickerRowTitle(
        { name: 'iPhone 14 Pro Max 6GB 256GB Physical + Esim' },
        'iPhone 14 Pro Max'
      )
    ).toBe('6GB 256GB Physical + Esim');
  });
});

describe('getProductPickerRowSubtitle', () => {
  it('formats condition, variant summary, and sku without object noise', () => {
    expect(
      getProductPickerRowSubtitle({
        condition: 'open_box',
        name: 'iPhone 14 Pro',
        sku: 'IPHONE_14_PRO',
        variant_attributes: [
          { param: 'storage', options: ['128GB', '256GB'] },
          { param: 'ram', options: ['6GB'] },
        ],
      })
    ).toBe('open box · 128GB / 256GB / 6GB · SKU: IPHONE_14_PRO');
  });

  it('returns N/A when no picker metadata is available', () => {
    expect(
      getProductPickerRowSubtitle({
        condition: null,
        name: 'Accessory',
        sku: null,
        variant_attributes: null,
      })
    ).toBe('N/A');
  });
});

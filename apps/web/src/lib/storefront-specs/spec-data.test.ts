import { describe, expect, it } from 'vitest';
import { buildProductSpecData } from './spec-data';

describe('buildProductSpecData', () => {
  it('builds detailed grouped specs from product_key_specs', () => {
    const result = buildProductSpecData({
      brand: 'Samsung',
      category: 'Smartphones',
      condition: 'new',
      product_key_specs: {
        display_type: 'Dynamic AMOLED 2X',
        screen_size_inches: 6.8,
        refresh_rate_hz: 120,
        chipset: 'Snapdragon 8 Elite',
        ram_gb: 12,
        storage_gb: 256,
        main_camera_mp: 200,
        battery_mah: 5000,
        charging_watt: 45,
        has_5g: true,
      },
    });

    expect(result.detailedSpecs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'Display' }),
        expect.objectContaining({ category: 'Platform' }),
        expect.objectContaining({ category: 'Memory' }),
        expect.objectContaining({ category: 'Battery' }),
      ])
    );
    expect(result.specs).toEqual(
      expect.arrayContaining([
        { label: 'Display', value: '6.8 inches' },
        { label: 'Processor', value: 'Snapdragon 8 Elite' },
        { label: 'RAM', value: '12GB' },
        { label: 'Storage', value: '256GB' },
        { label: 'Camera', value: '200MP' },
        { label: 'Battery', value: '5000mAh' },
      ])
    );
  });

  it('falls back to variant attributes without component imports', () => {
    const result = buildProductSpecData({
      brand: 'Apple',
      category: 'Smartphones',
      variant_attributes: [
        { param: 'Storage', options: ['256GB'] },
        { param: 'RAM', options: ['8GB'] },
      ],
    });

    expect(result.detailedSpecs).toEqual([
      {
        category: 'General',
        items: expect.arrayContaining([
          { label: 'Brand', value: 'Apple' },
          { label: 'Storage', value: '256GB' },
          { label: 'RAM', value: '8GB' },
        ]),
      },
    ]);
  });
});

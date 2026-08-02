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

  it('safely ignores malformed HTML description tables without throwing', () => {
    const result = buildProductSpecData({
      brand: 'Tecno',
      category: 'Smartphones',
      description:
        '<h2>Key Specs</h2><table><tr><td>Display<td>6.8 inches</tr>',
      product_key_specs: {
        chipset: 'Helio G99',
      },
    });

    expect(result.detailedSpecs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'Platform',
          items: [{ label: 'Chipset', value: 'Helio G99' }],
        }),
      ])
    );
  });

  it('omits null, undefined, and empty-string product key specs without throwing', () => {
    const result = buildProductSpecData({
      category: 'Smartphones',
      product_key_specs: {
        display_type: '   ',
        chipset: 'Snapdragon 8 Elite',
        gpu: '',
        ram_gb: null,
        storage_gb: undefined,
      },
    });

    expect(result.detailedSpecs).toEqual([
      {
        category: 'Platform',
        items: [{ label: 'Chipset', value: 'Snapdragon 8 Elite' }],
      },
    ]);
    expect(
      result.detailedSpecs.flatMap((section) => section.items)
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: '' }),
        expect.objectContaining({ value: '   ' }),
        expect.objectContaining({ value: 'undefined' }),
        expect.objectContaining({ value: 'null' }),
      ])
    );
  });

  it('keeps zero-valued numeric specs and formats them consistently', () => {
    const result = buildProductSpecData({
      category: 'Smartphones',
      product_key_specs: {
        ram_gb: 0,
        storage_gb: 0,
        battery_mah: 0,
      },
    });

    expect(result.detailedSpecs).toEqual(
      expect.arrayContaining([
        {
          category: 'Memory',
          items: [
            { label: 'Internal Storage', value: '0GB' },
            { label: 'RAM', value: '0GB' },
          ],
        },
        {
          category: 'Battery',
          items: [{ label: 'Capacity', value: '0mAh' }],
        },
      ])
    );
    expect(result.specs).toEqual(
      expect.arrayContaining([
        { label: 'RAM', value: '0GB' },
        { label: 'Storage', value: '0GB' },
        { label: 'Battery', value: '0mAh' },
      ])
    );
  });

  it('handles empty variant attributes with a safe General fallback', () => {
    const result = buildProductSpecData({
      category: 'Smartphones',
      variant_attributes: [],
    });

    expect(result.detailedSpecs).toEqual([
      {
        category: 'General',
        items: [
          { label: 'Brand', value: 'Generic' },
          { label: 'Condition', value: 'New' },
          { label: 'Category', value: 'Smartphones' },
        ],
      },
    ]);
  });

  it('normalizes malformed stored specification sections before rendering PDP specs', () => {
    const result = buildProductSpecData({
      detailedSpecs: [
        {
          category: undefined,
          items: [
            { label: ' Face value ', value: ' ₦30 gift card ' },
            { label: '', value: 'ignored' },
            { label: 'Numeric value', value: 30 },
          ],
        },
      ] as unknown as Parameters<
        typeof buildProductSpecData
      >[0]['detailedSpecs'],
    });

    expect(result.detailedSpecs).toEqual([
      {
        category: 'General',
        items: [
          { label: 'Face value', value: '₦30 gift card' },
          { label: 'Numeric value', value: '30' },
        ],
      },
    ]);
  });

  it('keeps camera PDPs on camera and legacy specification families', () => {
    const result = buildProductSpecData({
      category: 'Cameras',
      product_key_specs: {
        main_camera_mp: 45,
        screen_size_inches: 3,
        chipset: 'DIGIC X',
        has_5g: false,
        has_card_slot: false,
      },
      specifications: [
        {
          category: 'Imaging and recording',
          items: [
            { label: 'Sensor', value: '45MP full-frame CMOS' },
            { label: 'Video', value: '8K RAW' },
            { label: '5G Support', value: 'No' },
            { label: 'NFC', value: 'No' },
          ],
        },
        {
          category: 'Storage and media',
          items: [
            { label: 'Media', value: 'CFexpress Type B and UHS-II SD' },
            { label: 'Card Slot', value: 'N/A' },
          ],
        },
      ],
    });

    expect(result.detailedSpecs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'Imaging and recording' }),
        expect.objectContaining({ category: 'Storage and media' }),
      ])
    );
    expect(result.detailedSpecs.map((section) => section.category)).not.toEqual(
      expect.arrayContaining(['Network', 'Platform', 'Memory', 'Sound'])
    );
    expect(
      result.detailedSpecs.flatMap((section) => section.items)
    ).not.toEqual(
      expect.arrayContaining([
        { label: '5G Support', value: 'No' },
        { label: 'Card Slot', value: 'No' },
        { label: 'NFC', value: 'No' },
        { label: 'Card Slot', value: 'N/A' },
      ])
    );
    expect(result.specs).toEqual(
      expect.arrayContaining([
        { label: 'Camera', value: '45MP full-frame CMOS' },
        { label: 'Storage', value: 'CFexpress Type B and UHS-II SD' },
      ])
    );
  });

  it('filters phone-only rows parsed from camera descriptions', () => {
    const result = buildProductSpecData({
      category: 'Drones',
      description:
        '<h2>Key Specs</h2><table><tr><td>5G Support</td><td>No</td></tr><tr><td>Sensor</td><td>1-inch CMOS</td></tr></table>',
    });

    expect(result.detailedSpecs).toEqual([
      {
        category: 'Key Specs',
        items: [{ label: 'Sensor', value: '1-inch CMOS' }],
      },
      {
        category: 'General',
        items: [
          { label: 'Brand', value: 'Generic' },
          { label: 'Condition', value: 'New' },
          { label: 'Category', value: 'Drones' },
        ],
      },
    ]);
  });

  it('builds safe camera key specs when legacy specifications are unavailable', () => {
    const result = buildProductSpecData({
      category: 'Action Cameras',
      product_key_specs: {
        main_camera_mp: 40,
        screen_size_inches: 2.5,
        display_type: 'OLED touchscreen',
        battery_mah: 1950,
        wifi_bands: 'Wi-Fi 6',
        usb_type: 'USB-C',
        has_5g: false,
        has_headphone_jack: false,
      },
    });

    expect(result.detailedSpecs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'Imaging',
          items: [{ label: 'Effective Resolution', value: '40MP' }],
        }),
        expect.objectContaining({
          category: 'Display',
          items: expect.arrayContaining([
            { label: 'Size', value: '2.5 inches' },
            { label: 'Type', value: 'OLED touchscreen' },
          ]),
        }),
        expect.objectContaining({
          category: 'Power',
          items: [{ label: 'Capacity', value: '1950mAh' }],
        }),
      ])
    );
    expect(result.detailedSpecs.map((section) => section.category)).not.toEqual(
      expect.arrayContaining(['Network', 'Platform', 'Memory', 'Sound'])
    );
    expect(result.specs).toEqual(
      expect.arrayContaining([
        { label: 'Display', value: '2.5 inches' },
        { label: 'Camera', value: '40MP' },
        { label: 'Battery', value: '1950mAh' },
      ])
    );
  });

  it('includes camera internal storage in the summary when no card slot is present', () => {
    const result = buildProductSpecData({
      category: 'Instant Cameras',
      product_key_specs: {
        storage_gb: 8,
      },
    });

    expect(result.specs).toEqual(
      expect.arrayContaining([{ label: 'Storage', value: '8GB' }])
    );
  });

  it('does not turn generic accessory key specs into phone specifications', () => {
    const result = buildProductSpecData({
      category: 'Accessories',
      product_key_specs: {
        chipset: 'Apple U1',
        battery_mah: 0,
        has_5g: false,
        has_nfc: true,
      },
    });

    expect(result.detailedSpecs.map((section) => section.category)).toEqual([
      'General',
    ]);
    expect(
      result.detailedSpecs.flatMap((section) => section.items)
    ).not.toEqual(
      expect.arrayContaining([
        { label: '5G Support', value: 'No' },
        { label: 'Battery Capacity', value: '0mAh' },
        { label: 'Chipset', value: 'Apple U1' },
      ])
    );
  });

  it('retains safe key specs for general gaming products', () => {
    const result = buildProductSpecData({
      category: 'Gaming',
      product_key_specs: {
        chipset: 'Custom AMD Zen 2',
        gpu: 'RDNA 2',
        storage_gb: 825,
        has_5g: false,
      },
    });

    expect(result.detailedSpecs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'Processing',
          items: [
            { label: 'Processor', value: 'Custom AMD Zen 2' },
            { label: 'GPU', value: 'RDNA 2' },
          ],
        }),
        expect.objectContaining({
          category: 'Memory',
          items: [{ label: 'Internal Storage', value: '825GB' }],
        }),
      ])
    );
    expect(
      result.detailedSpecs.flatMap((section) => section.items)
    ).not.toEqual(
      expect.arrayContaining([{ label: '5G Support', value: 'No' }])
    );
  });
});

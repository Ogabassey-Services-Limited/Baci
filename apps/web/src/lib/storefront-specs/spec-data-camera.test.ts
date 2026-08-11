import { describe, expect, it } from 'vitest';
import { buildProductSpecData } from './spec-data';

describe('buildProductSpecData camera families', () => {
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

  it('drops persisted selfie-camera sections from camera PDP and comparison specs', () => {
    const result = buildProductSpecData({
      category: 'Cameras',
      specifications: [
        {
          category: 'Selfie Camera',
          items: [
            { label: 'Resolution', value: '12MP' },
            { label: 'Features', value: 'HDR' },
            { label: 'Video', value: '4K' },
          ],
        },
        {
          category: 'Imaging',
          items: [{ label: 'Sensor', value: 'APS-C CMOS' }],
        },
      ],
    });

    expect(result.detailedSpecs).toEqual([
      {
        category: 'Imaging',
        items: [{ label: 'Sensor', value: 'APS-C CMOS' }],
      },
    ]);
    expect(result.specs).not.toEqual(
      expect.arrayContaining([
        { label: 'Resolution', value: '12MP' },
        { label: 'Features', value: 'HDR' },
        { label: 'Video', value: '4K' },
      ])
    );
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

  it('uses a slug-only camera join before stale legacy phone text', () => {
    const result = buildProductSpecData({
      category: 'Smartphones',
      categories: { slug: 'action-cameras' },
      product_key_specs: {
        main_camera_mp: 40,
        has_5g: true,
      },
    });

    expect(result.detailedSpecs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'Imaging',
          items: [{ label: 'Effective Resolution', value: '40MP' }],
        }),
      ])
    );
    expect(result.detailedSpecs.map((section) => section.category)).not.toEqual(
      expect.arrayContaining(['Network'])
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
  it('filters stale phone rows from precomputed camera summary specs', () => {
    const result = buildProductSpecData({
      category: 'Cameras',
      specs: [
        { label: 'SIM', value: 'Nano-SIM' },
        { label: 'Card Slot', value: 'Not listed by manufacturer' },
        { label: 'Sensor', value: 'Full-frame CMOS' },
      ],
    });

    expect(result.specs).toEqual([
      { label: 'Sensor', value: 'Full-frame CMOS' },
    ]);
  });

  it('retains verified audio key specs for camera PDPs', () => {
    const result = buildProductSpecData({
      category: 'Cameras',
      product_key_specs: {
        has_stereo_speakers: true,
        has_headphone_jack: true,
      },
    });

    expect(result.detailedSpecs).toEqual([
      {
        category: 'Sound',
        items: [
          { label: 'Loudspeaker', value: 'Yes, with stereo speakers' },
          { label: '3.5mm Jack', value: 'Yes' },
        ],
      },
    ]);
  });

  it('retains verified NFC connectivity for camera PDPs', () => {
    const result = buildProductSpecData({
      category: 'Cameras',
      product_key_specs: { has_nfc: true },
    });

    expect(result.detailedSpecs).toEqual([
      {
        category: 'Connectivity',
        items: [{ label: 'NFC', value: 'Yes' }],
      },
    ]);
  });

  it('suppresses a camera card-slot type when the capability is explicitly false', () => {
    const result = buildProductSpecData({
      category: 'Cameras',
      product_key_specs: {
        card_slot_type: 'CFexpress Type B',
        has_card_slot: false,
      },
    });

    expect(
      result.detailedSpecs.flatMap((section) => section.items)
    ).not.toEqual(
      expect.arrayContaining([
        { label: 'Card Slot', value: 'CFexpress Type B' },
      ])
    );
  });

  it('suppresses legacy card-slot labels only when the stored capability is false', () => {
    const unavailable = buildProductSpecData({
      category: 'Cameras',
      detailedSpecs: [
        {
          category: 'Storage',
          items: [{ label: 'Card-Slot', value: 'CFexpress Type B' }],
        },
        {
          category: 'Media',
          items: [{ label: 'Memory Card Slot', value: 'UHS-II SD' }],
        },
      ],
      product_key_specs: { has_card_slot: false },
      specs: [{ label: 'Memory Card Slot', value: 'UHS-II SD' }],
    });
    const available = buildProductSpecData({
      category: 'Cameras',
      detailedSpecs: [
        {
          category: 'Storage',
          items: [{ label: 'Memory Card Slot', value: 'CFexpress Type B' }],
        },
      ],
      product_key_specs: { has_card_slot: true },
    });

    expect(
      unavailable.detailedSpecs.flatMap((section) => section.items)
    ).not.toContainEqual({ label: 'Card-Slot', value: 'CFexpress Type B' });
    expect(
      unavailable.detailedSpecs.flatMap((section) => section.items)
    ).not.toContainEqual({ label: 'Memory Card Slot', value: 'UHS-II SD' });
    expect(unavailable.specs).not.toContainEqual({
      label: 'Memory Card Slot',
      value: 'UHS-II SD',
    });
    expect(available.detailedSpecs).toEqual([
      {
        category: 'Storage',
        items: [{ label: 'Memory Card Slot', value: 'CFexpress Type B' }],
      },
    ]);
  });
});

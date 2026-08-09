import { describe, expect, it } from 'vitest';
import { collectProductSchemaSpecProperties } from './collect-product-schema-spec-properties';
import type { ProductKeySpecs } from './products';
import { makeSeoProduct } from './seo-utils-product-schema-test-helper';

describe('collectProductSchemaSpecProperties', () => {
  it('collects supported structured and legacy properties', () => {
    const collector = collectProductSchemaSpecProperties(
      makeSeoProduct({
        category: 'Cameras',
        product_key_specs: { main_camera_mp: 24, has_nfc: true },
        specifications: [
          {
            category: 'Features',
            items: [{ label: 'Weather Sealing', value: 'No' }],
          },
        ],
      })
    );

    expect(collector.getProperties()).toEqual(
      expect.arrayContaining([
        {
          '@type': 'PropertyValue',
          name: 'Main Camera',
          value: 'Single 24MP',
        },
        { '@type': 'PropertyValue', name: 'NFC', value: 'Yes' },
        { '@type': 'PropertyValue', name: 'Weather Sealing', value: 'No' },
      ])
    );
  });

  it('checks value presence before card-slot and wireless custom checks', () => {
    const collector = collectProductSchemaSpecProperties(
      makeSeoProduct({
        category: 'Smartphones',
        product_key_specs: {
          has_card_slot: true,
          has_wireless_charging: true,
          card_slot_type: null,
          wireless_charging_watt: undefined,
        } as unknown as ProductKeySpecs,
      })
    );

    expect(collector.getProperties()).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Card Slot' }),
        expect.objectContaining({ name: 'Wireless Charging' }),
      ])
    );
  });
});

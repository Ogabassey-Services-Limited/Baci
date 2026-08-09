import { createProductSchemaAdditionalPropertyCollector } from './product-schema-additional-properties';
import { shouldIncludeProductSchemaSpec } from './product-schema-specs';
import type { Product } from './products';
import { hasSupportedCardSlotType } from './storefront-specs/spec-category-families';

interface SpecMapping {
  key: string;
  name: string;
  format?: (value: string | number | boolean) => string;
  check?: (value: string | number | boolean) => boolean;
}

function hasPresentSpecValue(
  value: unknown
): value is string | number | boolean {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  return typeof value === 'number' || typeof value === 'boolean';
}

export function collectProductSchemaSpecProperties(product: Product) {
  const collector = createProductSchemaAdditionalPropertyCollector();
  const keySpecs = product.product_key_specs;

  if (keySpecs && !Array.isArray(keySpecs)) {
    const mappings: SpecMapping[] = [
      { key: 'network_technology', name: 'Network Technology' },
      {
        key: 'has_5g',
        name: '5G Support',
        format: (value) => (value ? 'Yes' : 'No'),
      },
      {
        key: 'has_nfc',
        name: 'NFC',
        format: (value) => (value ? 'Yes' : 'No'),
      },
      { key: 'dimensions_mm', name: 'Dimensions' },
      { key: 'weight_g', name: 'Weight', format: (value) => `${value}g` },
      { key: 'build_materials', name: 'Build' },
      { key: 'ip_rating', name: 'IP Rating' },
      { key: 'sim_type', name: 'SIM Type' },
      { key: 'display_type', name: 'Display Type' },
      {
        key: 'screen_size_inches',
        name: 'Screen Size',
        format: (value) => `${value} inches`,
      },
      { key: 'display_resolution', name: 'Display Resolution' },
      {
        key: 'refresh_rate_hz',
        name: 'Refresh Rate',
        format: (value) => `${value}Hz`,
      },
      {
        key: 'display_ppi',
        name: 'Pixel Density',
        format: (value) => `${value} ppi`,
      },
      {
        key: 'display_peak_brightness',
        name: 'Peak Brightness',
        format: (value) => `${value} nits`,
      },
      {
        key: 'android_version',
        name: 'Operating System',
        format: (value) => `Android ${value}`,
      },
      { key: 'chipset', name: 'Chipset' },
      { key: 'cpu_cores', name: 'CPU' },
      { key: 'gpu', name: 'GPU' },
      { key: 'ram_gb', name: 'RAM', format: (value) => `${value}GB` },
      {
        key: 'storage_gb',
        name: 'Internal Storage',
        format: (value) => `${value}GB`,
      },
      {
        key: 'card_slot_type',
        name: 'Card Slot',
        check: () => hasSupportedCardSlotType(keySpecs),
      },
      {
        key: 'front_camera_mp',
        name: 'Selfie Camera',
        format: (value) => `${value}MP`,
      },
      { key: 'rear_camera_video', name: 'Video Recording' },
      {
        key: 'has_stereo_speakers',
        name: 'Speakers',
        format: (value) => (value ? 'Stereo' : 'Mono'),
      },
      {
        key: 'has_headphone_jack',
        name: '3.5mm Headphone Jack',
        format: (value) => (value ? 'Yes' : 'No'),
      },
      { key: 'wifi_bands', name: 'WiFi' },
      { key: 'bluetooth_version', name: 'Bluetooth' },
      {
        key: 'usb_type',
        name: 'USB',
        format: (value) => `${value}${keySpecs.has_usb_otg ? ' (OTG)' : ''}`,
      },
      {
        key: 'has_fm_radio',
        name: 'FM Radio',
        format: () => 'Yes',
        check: (value) => Boolean(value),
      },
      { key: 'fingerprint_type', name: 'Fingerprint Sensor' },
      {
        key: 'battery_mah',
        name: 'Battery Capacity',
        format: (value) => `${value}mAh`,
      },
      {
        key: 'charging_watt',
        name: 'Fast Charging',
        format: (value) => `${value}W`,
      },
      {
        key: 'wireless_charging_watt',
        name: 'Wireless Charging',
        format: (value) => `${value}W`,
        check: () => Boolean(keySpecs.has_wireless_charging),
      },
    ];

    if (
      hasPresentSpecValue(keySpecs.main_camera_mp) &&
      shouldIncludeProductSchemaSpec(product, {
        key: 'main_camera_mp',
        value: keySpecs.main_camera_mp,
      })
    ) {
      const cameraType = keySpecs.has_quad_camera
        ? 'Quad'
        : keySpecs.has_triple_camera
          ? 'Triple'
          : keySpecs.has_dual_camera
            ? 'Dual'
            : 'Single';
      collector.add(
        'Main Camera',
        `${cameraType} ${keySpecs.main_camera_mp}MP`
      );
    }

    for (const mapping of mappings) {
      const value = keySpecs[mapping.key] as unknown;
      if (!hasPresentSpecValue(value)) {
        continue;
      }
      if (mapping.check && !mapping.check(value)) {
        continue;
      }
      if (
        !shouldIncludeProductSchemaSpec(product, {
          key: mapping.key,
          value,
        })
      ) {
        continue;
      }

      collector.add(
        mapping.name,
        mapping.format ? mapping.format(value) : String(value)
      );
    }
  }

  if (Array.isArray(product.specifications)) {
    for (const category of product.specifications) {
      if (!Array.isArray(category.items)) {
        continue;
      }

      for (const item of category.items) {
        if (
          shouldIncludeProductSchemaSpec(product, {
            label: item.label,
            value: item.value,
          })
        ) {
          collector.add(item.label, item.value);
        }
      }
    }
  }

  return collector;
}

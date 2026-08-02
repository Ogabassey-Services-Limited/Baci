import {
  type ComparableProductKeySpecs,
  KEY_SPEC_CATEGORIES,
  type ProductSpecFamily,
  type SpecCategory,
} from './spec-taxonomy';

const CAMERA_KEY_SPEC_CATEGORIES: SpecCategory[] = [
  {
    category: 'Imaging',
    fields: [
      {
        key: 'main_camera_mp',
        label: 'Effective Resolution',
        transform: (value: unknown) => `${value}MP`,
      },
      { key: 'rear_camera_features', label: 'Camera Features' },
      { key: 'rear_camera_video', label: 'Video Recording' },
    ],
  },
  {
    category: 'Display',
    fields: [
      { key: 'display_type', label: 'Type' },
      {
        key: 'screen_size_inches',
        label: 'Size',
        transform: (value: unknown) => `${value} inches`,
      },
      { key: 'display_resolution', label: 'Resolution' },
      {
        key: 'display_peak_brightness',
        label: 'Peak Brightness',
        transform: (value: unknown) => `${value} nits`,
      },
      { key: 'display_protection', label: 'Protection' },
    ],
  },
  {
    category: 'Body',
    fields: [
      { key: 'dimensions_mm', label: 'Dimensions' },
      {
        key: 'weight_g',
        label: 'Weight',
        transform: (value: unknown) => `${value}g`,
      },
      { key: 'build_materials', label: 'Build' },
      { key: 'ip_rating', label: 'Protection' },
    ],
  },
  {
    category: 'Processing',
    fields: [
      { key: 'chipset', label: 'Processor' },
      { key: 'cpu_cores', label: 'Processing' },
      { key: 'gpu', label: 'Graphics Processor' },
    ],
  },
  {
    category: 'Storage',
    fields: [
      {
        key: 'card_slot_type',
        label: 'Card Slot',
        condition: (specs: ComparableProductKeySpecs) =>
          typeof specs.card_slot_type === 'string' &&
          specs.card_slot_type.trim().length > 0 &&
          specs.card_slot_type.trim().toLowerCase() !== 'no',
      },
      {
        key: 'storage_gb',
        label: 'Internal Storage',
        transform: (value: unknown) => `${value}GB`,
      },
    ],
  },
  {
    category: 'Connectivity',
    fields: [
      { key: 'wifi_bands', label: 'Wi-Fi' },
      { key: 'bluetooth_version', label: 'Bluetooth' },
      { key: 'usb_type', label: 'USB' },
    ],
  },
  {
    category: 'Power',
    fields: [
      {
        key: 'battery_mah',
        label: 'Capacity',
        transform: (value: unknown) => `${value}mAh`,
      },
      {
        key: 'charging_watt',
        label: 'Charging',
        transform: (value: unknown) => `${value}W`,
      },
    ],
  },
  {
    category: 'Misc',
    fields: [
      { key: 'available_colors', label: 'Colors' },
      { key: 'model_numbers', label: 'Models' },
    ],
  },
];

const COMPUTER_EXCLUDED_KEYS = new Set([
  'has_5g',
  'has_fm_radio',
  'has_headphone_jack',
  'has_nfc',
  'has_stereo_speakers',
  'sim_type',
  'android_version',
  'fingerprint_type',
  'main_camera_mp',
  'rear_camera_features',
  'rear_camera_video',
  'front_camera_mp',
  'front_camera_features',
  'front_camera_video',
]);

const COMPUTER_KEY_SPEC_CATEGORIES = KEY_SPEC_CATEGORIES.map((category) => ({
  ...category,
  fields: category.fields.filter(({ key }) => !COMPUTER_EXCLUDED_KEYS.has(key)),
})).filter((category) => category.fields.length > 0);

export function getKeySpecCategoriesForFamily(
  family: ProductSpecFamily
): SpecCategory[] {
  if (family === 'camera') {
    return CAMERA_KEY_SPEC_CATEGORIES;
  }

  if (family === 'computer') {
    return COMPUTER_KEY_SPEC_CATEGORIES;
  }

  if (family === 'mobile') {
    return KEY_SPEC_CATEGORIES;
  }

  return [];
}

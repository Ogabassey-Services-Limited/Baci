import {
  type ComparableProductKeySpecs,
  KEY_SPEC_CATEGORIES,
  type ProductSpecFamily,
  type SpecCategory,
  type SpecField,
} from './spec-taxonomy';

const UNSUPPORTED_CARD_SLOT_VALUES = new Set([
  '',
  '0',
  'false',
  'n/a',
  'na',
  'none',
  'not applicable',
  'not available',
  'not listed',
  'not published',
  'not supported',
  'no',
  'unsupported',
  'unavailable',
]);

function isUnsupportedCardSlotValue(value: unknown) {
  if (typeof value === 'boolean') return !value;
  if (typeof value === 'number') return !Number.isFinite(value) || value === 0;
  if (typeof value !== 'string') return false;

  const normalized = value.trim().toLowerCase();
  return (
    UNSUPPORTED_CARD_SLOT_VALUES.has(normalized) ||
    normalized.startsWith('confirm exact')
  );
}

const VERIFIED_SOUND_FIELDS: SpecField[] = [
  {
    key: 'has_stereo_speakers',
    label: 'Loudspeaker',
    transform: () => 'Yes, with stereo speakers',
  },
  {
    key: 'has_headphone_jack',
    label: '3.5mm Jack',
    transform: () => 'Yes',
  },
];

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
          hasSupportedCardSlotType(specs),
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
  { category: 'Sound', fields: VERIFIED_SOUND_FIELDS },
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
  'has_nfc',
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

const GENERAL_KEY_SPEC_CATEGORIES: SpecCategory[] = [
  {
    category: 'Body',
    fields: [
      { key: 'dimensions_mm', label: 'Dimensions' },
      { key: 'weight_g', label: 'Weight', transform: (value) => `${value}g` },
      { key: 'build_materials', label: 'Build' },
      { key: 'ip_rating', label: 'Protection' },
    ],
  },
  {
    category: 'Display',
    fields: [
      { key: 'display_type', label: 'Type' },
      {
        key: 'screen_size_inches',
        label: 'Size',
        transform: (value) => `${value} inches`,
      },
      { key: 'display_resolution', label: 'Resolution' },
      {
        key: 'refresh_rate_hz',
        label: 'Refresh Rate',
        transform: (value) => `${value}Hz`,
      },
      {
        key: 'display_peak_brightness',
        label: 'Peak Brightness',
        transform: (value) => `${value} nits`,
      },
      { key: 'display_protection', label: 'Protection' },
    ],
  },
  {
    category: 'Processing',
    fields: [
      { key: 'chipset', label: 'Processor' },
      { key: 'cpu_cores', label: 'CPU' },
      { key: 'gpu', label: 'GPU' },
    ],
  },
  {
    category: 'Memory',
    fields: [
      {
        key: 'storage_gb',
        label: 'Internal Storage',
        transform: (value) => `${value}GB`,
      },
      { key: 'ram_gb', label: 'RAM', transform: (value) => `${value}GB` },
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
  { category: 'Sound', fields: VERIFIED_SOUND_FIELDS },
  {
    category: 'Power',
    fields: [
      {
        key: 'battery_mah',
        label: 'Capacity',
        transform: (value) => `${value}mAh`,
      },
      {
        key: 'charging_watt',
        label: 'Charging',
        transform: (value) => `${value}W`,
      },
      {
        key: 'wireless_charging_watt',
        label: 'Wireless Charging',
        transform: (value) => `${value}W`,
        condition: (specs) => Boolean(specs.has_wireless_charging),
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

export function hasSupportedCardSlotType(specs: ComparableProductKeySpecs) {
  return (
    specs.has_card_slot !== false &&
    !isUnsupportedCardSlotValue(specs.card_slot_type)
  );
}

export function isComputerExcludedSpecKey(key: string) {
  return COMPUTER_EXCLUDED_KEYS.has(key);
}

export function getKeySpecCategoryProjection(
  family: Exclude<ProductSpecFamily, 'general'> | 'general-supported'
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

  return GENERAL_KEY_SPEC_CATEGORIES;
}

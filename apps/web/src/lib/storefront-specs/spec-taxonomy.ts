export interface ComparableProductKeySpecs {
  [key: string]: unknown;
  android_version?: string;
  battery_removable?: boolean;
  card_slot_type?: string;
  has_card_slot?: boolean;
  has_dual_camera?: boolean;
  has_quad_camera?: boolean;
  has_reverse_charging?: boolean;
  has_triple_camera?: boolean;
  has_usb_otg?: boolean;
  has_wireless_charging?: boolean;
  wireless_charging_watt?: number;
}

export { SUMMARY_SPEC_PRIORITIES } from './spec-summary-priorities';

export type ProductSpecFamily = 'mobile' | 'computer' | 'camera' | 'general';

const CAMERA_CATEGORY_NAMES = new Set([
  'camera',
  'cameras',
  'action cameras',
  'instant cameras',
  'lenses',
  'drones',
  'gimbals',
  'microphones',
  'monitors & transmitters',
  'tripod stands',
  'camera accessories',
  'instant film',
  'memory cards',
]);

const ACCESSORY_CATEGORY_MARKERS = [
  'accessor',
  'accessories',
  'accessory',
  'case',
  'cases',
  'keyboard',
  'charger',
  'cover',
  'stand',
  'cable',
  'adapter',
  'mouse',
  'sleeve',
  'bag',
  'dock',
  'hub',
];

export function isAccessoryLikeCategory(categoryName: string) {
  return ACCESSORY_CATEGORY_MARKERS.some((marker) =>
    new RegExp(`(^|[^a-z])${marker}(s)?([^a-z]|$)`).test(categoryName)
  );
}

export function isCameraLikeCategory(categoryName: string) {
  const normalized = categoryName.trim().toLowerCase().replace(/\s+/g, ' ');
  return CAMERA_CATEGORY_NAMES.has(normalized) || normalized.includes('camera');
}

export function getProductSpecFamily(
  categoryName: string | null | undefined
): ProductSpecFamily {
  const normalized = categoryName?.trim().toLowerCase() || '';
  const isAccessory = isAccessoryLikeCategory(normalized);

  // Camera families intentionally take precedence over the generic accessory
  // guard. Camera accessories, lenses, drones, and gimbals still need the
  // camera-safe projection rather than mobile/general device fields.
  if (isCameraLikeCategory(normalized)) {
    return 'camera';
  }

  if (
    !isAccessory &&
    (/(^|[^a-z])(cell|iphone|ipad|phone|smartphone|tablet|smartwatch|wearable|watch)(s)?([^a-z]|$)/.test(
      normalized
    ) ||
      normalized.includes('google pixel'))
  ) {
    return 'mobile';
  }

  if (
    !isAccessory &&
    /(^|[^a-z])(laptop|desktop|computer|notebook|macbook)(s)?([^a-z]|$)/.test(
      normalized
    )
  ) {
    return 'computer';
  }

  return 'general';
}

export interface SpecField {
  key: string;
  label: string;
  dynamicLabel?: (specs: ComparableProductKeySpecs) => string;
  transform?: (value: unknown, allSpecs: ComparableProductKeySpecs) => string;
  condition?: (specs: ComparableProductKeySpecs) => boolean;
}

export interface SpecCategory {
  category: string;
  fields: SpecField[];
}

export const KEY_SPEC_CATEGORIES: SpecCategory[] = [
  {
    category: 'Network',
    fields: [
      { key: 'network_technology', label: 'Technology' },
      {
        key: 'has_5g',
        label: '5G Support',
        transform: (v: unknown) => (v ? 'Yes' : 'No'),
      },
    ],
  },
  {
    category: 'Body',
    fields: [
      { key: 'dimensions_mm', label: 'Dimensions' },
      { key: 'weight_g', label: 'Weight', transform: (v: unknown) => `${v}g` },
      { key: 'build_materials', label: 'Build' },
      { key: 'sim_type', label: 'SIM' },
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
        transform: (v: unknown) => `${v} inches`,
      },
      { key: 'display_resolution', label: 'Resolution' },
      {
        key: 'refresh_rate_hz',
        label: 'Refresh Rate',
        transform: (v: unknown) => `${v}Hz`,
      },
      {
        key: 'display_ppi',
        label: 'Pixel Density',
        transform: (v: unknown) => `${v} ppi`,
      },
      {
        key: 'display_peak_brightness',
        label: 'Peak Brightness',
        transform: (v: unknown) => `${v} nits`,
      },
      { key: 'display_protection', label: 'Protection' },
    ],
  },
  {
    category: 'Platform',
    fields: [
      {
        key: 'android_version',
        label: 'OS',
        transform: (v: unknown) => `Android ${v}`,
      },
      { key: 'chipset', label: 'Chipset' },
      { key: 'cpu_cores', label: 'CPU' },
      { key: 'gpu', label: 'GPU' },
    ],
  },
  {
    category: 'Memory',
    fields: [
      {
        key: 'has_card_slot',
        label: 'Card Slot',
        transform: (_v: unknown, allSpecs: ComparableProductKeySpecs) =>
          allSpecs.has_card_slot ? allSpecs.card_slot_type || 'Yes' : 'No',
      },
      {
        key: 'storage_gb',
        label: 'Internal Storage',
        transform: (v: unknown) => `${v}GB`,
      },
      { key: 'ram_gb', label: 'RAM', transform: (v: unknown) => `${v}GB` },
    ],
  },
  {
    category: 'Main Camera',
    fields: [
      {
        key: 'main_camera_mp',
        label: 'Camera',
        dynamicLabel: (allSpecs: ComparableProductKeySpecs) =>
          allSpecs.has_quad_camera
            ? 'Quad Camera'
            : allSpecs.has_triple_camera
              ? 'Triple Camera'
              : allSpecs.has_dual_camera
                ? 'Dual Camera'
                : 'Single Camera',
        transform: (v: unknown) => `${v}MP`,
      },
      { key: 'rear_camera_features', label: 'Features' },
      { key: 'rear_camera_video', label: 'Video' },
    ],
  },
  {
    category: 'Selfie Camera',
    fields: [
      {
        key: 'front_camera_mp',
        label: 'Resolution',
        transform: (v: unknown) => `${v}MP`,
      },
      { key: 'front_camera_features', label: 'Features' },
      { key: 'front_camera_video', label: 'Video' },
    ],
  },
  {
    category: 'Sound',
    fields: [
      {
        key: 'has_stereo_speakers',
        label: 'Loudspeaker',
        transform: (v: unknown) =>
          v ? 'Yes, with stereo speakers' : 'Yes (mono)',
      },
      {
        key: 'has_headphone_jack',
        label: '3.5mm Jack',
        transform: (v: unknown) => (v ? 'Yes' : 'No'),
      },
    ],
  },
  {
    category: 'Connectivity',
    fields: [
      { key: 'wifi_bands', label: 'WLAN' },
      { key: 'bluetooth_version', label: 'Bluetooth' },
      { key: 'positioning', label: 'Positioning' },
      {
        key: 'has_nfc',
        label: 'NFC',
        transform: (v: unknown) => (v ? 'Yes' : 'No'),
      },
      {
        key: 'has_fm_radio',
        label: 'Radio',
        transform: (v: unknown) => (v ? 'FM Radio' : 'No'),
      },
      {
        key: 'usb_type',
        label: 'USB',
        transform: (v: unknown, allSpecs: ComparableProductKeySpecs) =>
          `${String(v)}${allSpecs.has_usb_otg ? ', OTG' : ''}`,
      },
    ],
  },
  {
    category: 'Features',
    fields: [
      { key: 'fingerprint_type', label: 'Fingerprint' },
      { key: 'sensors', label: 'Sensors' },
    ],
  },
  {
    category: 'Battery',
    fields: [
      {
        key: 'battery_mah',
        label: 'Capacity',
        transform: (v: unknown, allSpecs: ComparableProductKeySpecs) =>
          `${v}mAh${allSpecs.battery_removable ? ' (removable)' : ''}`,
      },
      {
        key: 'charging_watt',
        label: 'Wired Charging',
        transform: (v: unknown) => `${v}W`,
      },
      {
        key: 'wireless_charging_watt',
        label: 'Wireless Charging',
        transform: (v: unknown) => `${v}W`,
        condition: (allSpecs: ComparableProductKeySpecs) =>
          Boolean(allSpecs.has_wireless_charging),
      },
      {
        key: 'has_reverse_charging',
        label: 'Reverse Charging',
        transform: () => 'Yes',
        condition: (allSpecs: ComparableProductKeySpecs) =>
          Boolean(allSpecs.has_reverse_charging),
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

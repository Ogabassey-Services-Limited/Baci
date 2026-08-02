import type { Product } from './products';
import { getKeySpecCategoriesForFamily } from './storefront-specs/spec-category-families';
import { isCameraLikeCategory } from './storefront-specs/spec-taxonomy';

type ProductCategorySource = Pick<Product, 'category' | 'categories'>;

interface ProductSchemaSpecCandidate {
  key?: string;
  label?: string;
  value: unknown;
}

const CAMERA_ONLY_SPEC_KEYS = new Set([
  'main_camera_mp',
  'rear_camera_features',
  'rear_camera_video',
  'front_camera_mp',
  'front_camera_features',
  'front_camera_video',
]);

const CAMERA_KEY_SPEC_KEYS = new Set(
  getKeySpecCategoriesForFamily('camera').flatMap((category) =>
    category.fields.map((field) => field.key)
  )
);

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

const PHONE_TABLET_LAPTOP_CATEGORY_WORDS = new Set([
  'cell',
  'iphone',
  'iphones',
  'laptops',
  'ipad',
  'ipads',
  'laptop',
  'macbook',
  'macbooks',
  'mobile',
  'phone',
  'phones',
  'smartphone',
  'smartphones',
  'tablet',
  'tablets',
  'smartwatch',
  'smartwatches',
  'wearable',
  'wearables',
  'watch',
  'watches',
  'pixel',
]);

const PHONE_ONLY_SPEC_KEYS = new Set([
  'android_version',
  'fingerprint_type',
  'has_5g',
  'has_card_slot',
  'has_fm_radio',
  'has_headphone_jack',
  'has_nfc',
  'has_stereo_speakers',
  'sim_type',
]);

const PHONE_ONLY_SPEC_LABELS = new Set([
  '3 5mm headphone jack',
  '3 5mm jack',
  'android',
  'card slot',
  'fingerprint sensor',
  'fm radio',
  'headphone jack',
  'loudspeaker',
  'nfc',
  'operating system',
  'os',
  'sim',
  'sim type',
  'speakers',
  '5g',
  '5g support',
  'ois',
  'has ois',
]);

const SPEC_LABEL_TO_KEY: Record<string, string> = {
  '3 5mm headphone jack': 'has_headphone_jack',
  '3 5mm jack': 'has_headphone_jack',
  android: 'android_version',
  'battery capacity': 'battery_mah',
  bluetooth: 'bluetooth_version',
  build: 'build_materials',
  'card slot': 'card_slot_type',
  chipset: 'chipset',
  charging: 'charging_watt',
  colors: 'available_colors',
  cpu: 'cpu_cores',
  dimensions: 'dimensions_mm',
  'display protection': 'display_protection',
  'display resolution': 'display_resolution',
  'display type': 'display_type',
  'fast charging': 'charging_watt',
  'fingerprint sensor': 'fingerprint_type',
  'fm radio': 'has_fm_radio',
  gpu: 'gpu',
  'has ois': 'has_ois',
  'internal storage': 'storage_gb',
  'ip rating': 'ip_rating',
  'main camera': 'main_camera_mp',
  models: 'model_numbers',
  nfc: 'has_nfc',
  'network technology': 'network_technology',
  'operating system': 'android_version',
  os: 'android_version',
  'peak brightness': 'display_peak_brightness',
  'pixel density': 'display_ppi',
  processing: 'cpu_cores',
  ram: 'ram_gb',
  resolution: 'display_resolution',
  'screen size': 'screen_size_inches',
  'selfie camera': 'front_camera_mp',
  sim: 'sim_type',
  'sim type': 'sim_type',
  speakers: 'has_stereo_speakers',
  storage: 'storage_gb',
  'video recording': 'rear_camera_video',
  wifi: 'wifi_bands',
  wireless: 'wireless_charging_watt',
  'wireless charging': 'wireless_charging_watt',
  usb: 'usb_type',
};

const UNSUPPORTED_SPEC_VALUES = new Set([
  '',
  '0',
  'false',
  'n/a',
  'na',
  'none',
  'not applicable',
  'not available',
  'not supported',
  'no',
  'unsupported',
  'unavailable',
]);

function normalizeCategoryName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function isAccessoryLikeCategory(categoryName: string) {
  return ACCESSORY_CATEGORY_MARKERS.some((marker) =>
    new RegExp(`(^|[^a-z])${marker}(s)?([^a-z]|$)`).test(categoryName)
  );
}

function getProductCategoryNames(product: ProductCategorySource) {
  const preferredCategory =
    product.categories?.name?.trim() || product.category;
  return preferredCategory?.trim()
    ? [normalizeCategoryName(preferredCategory)]
    : [];
}

function isPhoneTabletLaptopCategory(categoryName: string) {
  if (isAccessoryLikeCategory(categoryName)) {
    return false;
  }

  return (
    categoryName.includes('google pixel') ||
    categoryName
      .split(/[^a-z0-9]+/)
      .some((word) => PHONE_TABLET_LAPTOP_CATEGORY_WORDS.has(word))
  );
}

function normalizeSpecLabel(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function isUnsupportedSpecValue(value: unknown) {
  if (typeof value === 'boolean') {
    return !value;
  }

  if (typeof value === 'number') {
    return !Number.isFinite(value) || value === 0;
  }

  if (typeof value !== 'string') {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return (
    UNSUPPORTED_SPEC_VALUES.has(normalized) ||
    /^0(?:\.0+)?(?:\s*[a-z]+)?$/.test(normalized) ||
    normalized.startsWith('confirm exact') ||
    normalized.startsWith('not listed') ||
    normalized.startsWith('not published')
  );
}

/**
 * Keeps phone-shaped fields and labels out of named non-phone product schemas.
 * Phone, tablet, and laptop categories retain the legacy mapping behavior.
 * Non-phone card-slot and OIS labels are retained only when their values are
 * supported, while unrelated non-phone specification labels remain eligible.
 */
export function shouldIncludeProductSchemaSpec(
  product: ProductCategorySource,
  candidate: ProductSchemaSpecCandidate
) {
  const categoryNames = getProductCategoryNames(product);
  if (categoryNames.length === 0) {
    return true;
  }

  const hasNonPhoneCategory = categoryNames.some(
    (categoryName) =>
      isCameraLikeCategory(categoryName) ||
      !isPhoneTabletLaptopCategory(categoryName)
  );
  if (!hasNonPhoneCategory) {
    return true;
  }

  if (candidate.key === 'card_slot_type') {
    return !isUnsupportedSpecValue(candidate.value);
  }

  const hasCameraCategory = categoryNames.some(isCameraLikeCategory);
  const inferredCameraSpecKey =
    hasCameraCategory && candidate.label
      ? SPEC_LABEL_TO_KEY[normalizeSpecLabel(candidate.label)]
      : undefined;
  const cameraSpecKey = candidate.key || inferredCameraSpecKey;
  if (
    hasCameraCategory &&
    cameraSpecKey &&
    (!CAMERA_KEY_SPEC_KEYS.has(cameraSpecKey) ||
      isUnsupportedSpecValue(candidate.value))
  ) {
    return false;
  }

  if (
    candidate.key &&
    CAMERA_ONLY_SPEC_KEYS.has(candidate.key) &&
    !hasCameraCategory &&
    !categoryNames.some(isPhoneTabletLaptopCategory)
  ) {
    return false;
  }

  if (candidate.key && PHONE_ONLY_SPEC_KEYS.has(candidate.key)) {
    return false;
  }

  if (!candidate.label) {
    return true;
  }

  const normalizedLabel = normalizeSpecLabel(candidate.label);
  if (!PHONE_ONLY_SPEC_LABELS.has(normalizedLabel)) {
    return true;
  }

  if (normalizedLabel === 'card slot' || normalizedLabel === 'ois') {
    return !isUnsupportedSpecValue(candidate.value);
  }

  if (normalizedLabel === 'operating system' || normalizedLabel === 'os') {
    return !isUnsupportedSpecValue(candidate.value);
  }

  return false;
}

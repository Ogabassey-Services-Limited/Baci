import { getProductSchemaSpecValueDecision } from './product-schema-spec-value-policy';
import { getProductSchemaSpecKeyForLabel } from './product-schema-spec-vocabulary';
import { resolveStorefrontProductCategoryName } from './storefront-product-category-name';
import { isComputerExcludedSpecKey } from './storefront-specs/is-computer-excluded-spec-key';
import { isAccessoryLikeCategory } from './storefront-specs/spec-accessory-classifier';
import { getKeySpecCategoriesForFamily } from './storefront-specs/spec-category-families';
import {
  getProductSpecFamily,
  isCameraLikeCategory,
} from './storefront-specs/spec-taxonomy';

type ProductCategorySource = {
  categories?: { name?: string | null; slug?: string | null } | null;
  category?: string | null;
  category_slug?: string | null;
  product_key_specs?: { has_card_slot?: boolean } | null;
};

interface ProductSchemaSpecCandidate {
  key?: string;
  label?: string;
  value: unknown;
}

const CAMERA_ONLY_SPEC_KEYS = new Set([
  'has_ois',
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
  'network_technology',
  'sim_type',
]);

const AUDIO_CAPABILITY_SPEC_KEYS = new Set([
  'has_headphone_jack',
  'has_stereo_speakers',
]);

const COMPUTER_CELLULAR_SPEC_KEYS = new Set(['has_5g', 'has_nfc', 'sim_type']);

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

const AUDIO_CAPABILITY_LABELS = new Set([
  '3 5mm headphone jack',
  '3 5mm jack',
  'headphone jack',
  'loudspeaker',
  'speakers',
]);

function normalizeCategoryName(value: string) {
  return value.trim().toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ');
}

function getProductCategoryNames(product: ProductCategorySource) {
  const preferredCategory = resolveStorefrontProductCategoryName(product);
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
  const inferredSpecKey = candidate.label
    ? getProductSchemaSpecKeyForLabel(candidate.label)
    : undefined;
  const canonicalSpecKey = candidate.key || inferredSpecKey;
  const normalizedLabel = candidate.label
    ? normalizeSpecLabel(candidate.label)
    : undefined;

  // Capability data is authoritative over legacy labels. This must precede
  // the mobile fast path because old PDP rows do not always retain their key.
  if (
    product.product_key_specs?.has_card_slot === false &&
    canonicalSpecKey === 'card_slot_type'
  ) {
    return false;
  }

  const productFamily = getProductSpecFamily(categoryNames[0]);
  const isMobileCategory =
    productFamily === 'mobile' ||
    (productFamily === 'general' &&
      categoryNames.some(isPhoneTabletLaptopCategory));
  const valueDecision = getProductSchemaSpecValueDecision({
    canonicalSpecKey,
    hasCategory: categoryNames.length > 0,
    isMobileCategory,
    isPhoneOnlyLabel: normalizedLabel
      ? PHONE_ONLY_SPEC_LABELS.has(normalizedLabel)
      : false,
    normalizedLabel,
    productFamily,
    value: candidate.value,
  });
  if (valueDecision !== 'defer') {
    return valueDecision === 'include';
  }

  if (isMobileCategory) {
    return true;
  }

  if (canonicalSpecKey === 'card_slot_type') {
    return true;
  }

  const hasCameraCategory = categoryNames.some(isCameraLikeCategory);
  const isOperatingSystemLabel =
    normalizedLabel === 'operating system' || normalizedLabel === 'os';
  if (productFamily === 'computer') {
    const computerSpecKey = canonicalSpecKey;
    if (
      computerSpecKey &&
      isComputerExcludedSpecKey(computerSpecKey) &&
      !(computerSpecKey === 'android_version' && isOperatingSystemLabel)
    ) {
      return false;
    }

    if (
      isOperatingSystemLabel &&
      typeof candidate.value === 'string' &&
      candidate.value.trim().toLowerCase().startsWith('android')
    ) {
      return false;
    }

    if (canonicalSpecKey && COMPUTER_CELLULAR_SPEC_KEYS.has(canonicalSpecKey)) {
      return true;
    }
  }

  const inferredCameraSpecKey =
    hasCameraCategory && candidate.label && !isOperatingSystemLabel
      ? inferredSpecKey
      : undefined;
  const cameraSpecKey = candidate.key || inferredCameraSpecKey;
  if (
    hasCameraCategory &&
    cameraSpecKey &&
    !CAMERA_KEY_SPEC_KEYS.has(cameraSpecKey) &&
    !AUDIO_CAPABILITY_SPEC_KEYS.has(cameraSpecKey)
  ) {
    return false;
  }

  if (
    canonicalSpecKey &&
    CAMERA_ONLY_SPEC_KEYS.has(canonicalSpecKey) &&
    !hasCameraCategory &&
    !isMobileCategory
  ) {
    return false;
  }

  if (canonicalSpecKey && PHONE_ONLY_SPEC_KEYS.has(canonicalSpecKey)) {
    if (hasCameraCategory && CAMERA_KEY_SPEC_KEYS.has(canonicalSpecKey)) {
      return true;
    }

    if (AUDIO_CAPABILITY_SPEC_KEYS.has(canonicalSpecKey)) {
      return true;
    }

    if (canonicalSpecKey === 'android_version' && isOperatingSystemLabel) {
      return true;
    }

    return false;
  }

  if (!normalizedLabel) {
    return true;
  }

  if (!PHONE_ONLY_SPEC_LABELS.has(normalizedLabel)) {
    return true;
  }

  if (normalizedLabel === 'card slot' || normalizedLabel === 'ois') {
    return true;
  }

  if (normalizedLabel === 'operating system' || normalizedLabel === 'os') {
    return true;
  }

  if (AUDIO_CAPABILITY_LABELS.has(normalizedLabel)) {
    return true;
  }

  return false;
}

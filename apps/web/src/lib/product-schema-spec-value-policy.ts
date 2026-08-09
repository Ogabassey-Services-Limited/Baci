import { isUnsupportedSpecValue } from './storefront-specs/is-unsupported-spec-value';

type ProductSchemaSpecValueDecision = 'defer' | 'exclude' | 'include';

interface ProductSchemaSpecValuePolicyInput {
  canonicalSpecKey?: string;
  hasCategory: boolean;
  isMobileCategory: boolean;
  isPhoneOnlyLabel: boolean;
  normalizedLabel?: string;
  value: unknown;
}

const EXPLICIT_NEGATIVE_CAPABILITY_SPEC_KEYS = new Set([
  'battery_removable',
  'card_slot_type',
  'has_5g',
  'has_card_slot',
  'has_fm_radio',
  'has_headphone_jack',
  'has_nfc',
  'has_ois',
  'has_reverse_charging',
  'has_stereo_speakers',
  'has_usb_otg',
  'has_wireless_charging',
]);

const MEASUREMENT_SPEC_KEYS = new Set([
  'battery_mah',
  'charging_watt',
  'dimensions_mm',
  'display_peak_brightness',
  'display_ppi',
  'display_resolution',
  'front_camera_mp',
  'main_camera_mp',
  'ram_gb',
  'refresh_rate_hz',
  'screen_size_inches',
  'storage_gb',
  'weight_g',
  'wireless_charging_watt',
]);

function isExplicitNegativeSpecValue(value: unknown) {
  return (
    value === false ||
    (typeof value === 'string' &&
      ['false', 'no'].includes(value.trim().toLowerCase()))
  );
}

function isMeasurementSpec(
  canonicalSpecKey: string | undefined,
  normalizedLabel: string | undefined
) {
  return (
    (canonicalSpecKey !== undefined &&
      MEASUREMENT_SPEC_KEYS.has(canonicalSpecKey)) ||
    (normalizedLabel !== undefined &&
      /\b(?:brightness|capacity|dimensions?|megapixels?|ppi|ram|refresh rate|resolution|screen size|storage|weight|wattage)\b/.test(
        normalizedLabel
      ))
  );
}

export function getProductSchemaSpecValueDecision({
  canonicalSpecKey,
  hasCategory,
  isMobileCategory,
  isPhoneOnlyLabel,
  normalizedLabel,
  value,
}: ProductSchemaSpecValuePolicyInput): ProductSchemaSpecValueDecision {
  if (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && !value.trim())
  ) {
    return 'exclude';
  }

  const measurementSpec = isMeasurementSpec(canonicalSpecKey, normalizedLabel);
  if (
    measurementSpec &&
    ((typeof value === 'number' && value <= 0) ||
      (typeof value === 'string' && /^-\d/.test(value.trim())))
  ) {
    return 'exclude';
  }

  if (!isUnsupportedSpecValue(value)) {
    return 'defer';
  }

  if (!isExplicitNegativeSpecValue(value)) {
    return 'exclude';
  }
  if (!hasCategory || measurementSpec) {
    return 'exclude';
  }
  if (canonicalSpecKey) {
    return isMobileCategory &&
      EXPLICIT_NEGATIVE_CAPABILITY_SPEC_KEYS.has(canonicalSpecKey)
      ? 'include'
      : 'exclude';
  }
  if (!normalizedLabel) {
    return 'exclude';
  }
  if (isPhoneOnlyLabel) {
    return isMobileCategory ? 'include' : 'exclude';
  }

  return 'defer';
}

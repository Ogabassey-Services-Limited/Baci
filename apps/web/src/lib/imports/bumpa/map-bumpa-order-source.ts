const DIRECT_SOURCE_MAP: Record<string, string> = {
  facebook: 'facebook',
  instagram: 'instagram',
  manual: 'manual',
  'staff entry': 'staff_entry',
  'staff-entry': 'staff_entry',
  staff_entry: 'staff_entry',
  tiktok: 'tiktok',
  whatsapp: 'whatsapp',
};

const PHYSICAL_SOURCE_VALUES = new Set([
  'in store',
  'in-store',
  'instore',
  'offline',
  'physical',
  'physical store',
  'store',
  'walk in',
  'walk-in',
  'walkin',
]);

const WEBSITE_SOURCE_VALUES = new Set([
  'bumpa site',
  'checkout',
  'mobile',
  'online',
  'online store',
  'online_store',
  'other',
  'others',
  'paystack',
  'site',
  'storefront',
  'web',
  'website',
]);

function normalizeSourceValue(value: string | null | undefined) {
  return (
    value
      ?.trim()
      .toLowerCase()
      .replace(/[_\s]+/g, ' ')
      .replace(/\s*-\s*/g, '-')
      .replace(/\s+/g, ' ') || ''
  );
}

function toFallbackSourceKey(value: string) {
  return value.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export function mapBumpaOrderSource(
  origin: string | null | undefined,
  channel: string | null | undefined
) {
  const normalizedOrigin = normalizeSourceValue(origin);

  if (normalizedOrigin) {
    if (DIRECT_SOURCE_MAP[normalizedOrigin]) {
      return DIRECT_SOURCE_MAP[normalizedOrigin];
    }

    if (PHYSICAL_SOURCE_VALUES.has(normalizedOrigin)) {
      return 'physical';
    }

    if (WEBSITE_SOURCE_VALUES.has(normalizedOrigin)) {
      return 'online_store';
    }

    return toFallbackSourceKey(normalizedOrigin);
  }

  const normalizedChannel = normalizeSourceValue(channel);
  if (PHYSICAL_SOURCE_VALUES.has(normalizedChannel)) {
    return 'physical';
  }

  return 'online_store';
}

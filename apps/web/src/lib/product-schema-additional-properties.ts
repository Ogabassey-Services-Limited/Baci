interface ProductSchemaAdditionalProperty {
  '@type': 'PropertyValue';
  name?: string;
  propertyID?: string;
  value: unknown;
  [key: string]: unknown;
}

const PROPERTY_NAME_ALIASES: Record<string, string> = {
  '3.5mm headphone jack': '3.5mm jack',
  '3.5mm jack': '3.5mm jack',
  loudspeaker: 'speakers',
  speakers: 'speakers',
  video: 'video recording',
  'video recording': 'video recording',
  'wi-fi': 'wifi',
  wifi: 'wifi',
  wlan: 'wifi',
};

function normalizePropertyText(value: unknown) {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized || null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  return null;
}

function normalizePropertyName(value: unknown) {
  const normalized = normalizePropertyText(value);
  return normalized?.replace(/\s+/g, ' ') || null;
}

function canonicalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ');
}

function getCanonicalPropertyName(name: string) {
  const normalizedName = canonicalizeText(name);
  return PROPERTY_NAME_ALIASES[normalizedName] || normalizedName;
}

function serializePropertyValue(value: unknown): string | null {
  const normalized = normalizePropertyText(value);
  if (normalized) {
    return canonicalizeText(normalized);
  }

  if (value && typeof value === 'object') {
    return JSON.stringify(value);
  }

  return null;
}

function isValidCustomPropertyValue(value: unknown) {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value);
  }

  return true;
}

export function createProductSchemaAdditionalPropertyCollector() {
  const properties: ProductSchemaAdditionalProperty[] = [];
  const propertyKeys = new Set<string>();

  return {
    add(name: unknown, value: unknown) {
      const normalizedName = normalizePropertyText(name);
      const normalizedValue = normalizePropertyText(value);
      if (!normalizedName || !normalizedValue) {
        return;
      }

      const propertyKey = `${getCanonicalPropertyName(normalizedName)}|${canonicalizeText(normalizedValue)}`;
      if (propertyKeys.has(propertyKey)) {
        return;
      }

      propertyKeys.add(propertyKey);
      properties.push({
        '@type': 'PropertyValue',
        name: normalizedName,
        value: normalizedValue,
      });
    },
    addCustomProperty(property: unknown) {
      if (
        !property ||
        typeof property !== 'object' ||
        Array.isArray(property)
      ) {
        return;
      }

      const candidate = property as Record<string, unknown>;
      const normalizedName = normalizePropertyName(candidate.name);
      const normalizedPropertyId = normalizePropertyName(candidate.propertyID);
      if (
        (!normalizedName && !normalizedPropertyId) ||
        !isValidCustomPropertyValue(candidate.value)
      ) {
        return;
      }

      if (
        candidate['@type'] !== undefined &&
        candidate['@type'] !== 'PropertyValue'
      ) {
        return;
      }

      const serializedValue = serializePropertyValue(candidate.value);
      if (!serializedValue) {
        return;
      }

      const propertyIdentifier = normalizedName
        ? getCanonicalPropertyName(normalizedName)
        : `propertyid:${canonicalizeText(normalizedPropertyId || '')}`;
      const propertyKey = `${propertyIdentifier}|${serializedValue}`;
      if (propertyKeys.has(propertyKey)) {
        return;
      }

      propertyKeys.add(propertyKey);
      properties.push({
        ...candidate,
        '@type': 'PropertyValue',
        ...(normalizedName ? { name: normalizedName } : {}),
        ...(normalizedPropertyId ? { propertyID: normalizedPropertyId } : {}),
        value: candidate.value,
      });
    },
    getProperties() {
      return properties;
    },
  };
}

interface ProductSchemaAdditionalProperty {
  '@type': 'PropertyValue';
  name: string;
  value: string;
}

const PROPERTY_NAME_ALIASES: Record<string, string> = {
  '3.5mm headphone jack': '3.5mm jack',
  '3.5mm jack': '3.5mm jack',
  loudspeaker: 'speakers',
  speakers: 'speakers',
  video: 'video recording',
  'video recording': 'video recording',
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

      const canonicalName =
        PROPERTY_NAME_ALIASES[
          normalizedName.toLowerCase().replace(/\s+/g, ' ')
        ] || normalizedName.toLowerCase().replace(/\s+/g, ' ');
      const propertyKey = `${canonicalName}|${normalizedValue
        .toLowerCase()
        .replace(/\s+/g, ' ')}`;
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
    getProperties() {
      return properties;
    },
  };
}

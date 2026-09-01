const COMMERCE_VARIANT_AXIS_ALIASES: Record<string, string> = {
  colour: 'color',
  gpu: 'graphics',
  ram_options: 'ram',
  storage_capacity: 'storage',
};

const COMMERCE_VARIANT_AXES = new Set([
  'bundle',
  'capacity',
  'case_size',
  'color',
  'condition',
  'configuration',
  'connectivity',
  'edition',
  'extended_warranty',
  'generation',
  'graphics',
  'memory',
  'network',
  'notebook_size',
  'platform',
  'processor',
  'ram',
  'region',
  'rom',
  'sim_type',
  'size',
  'storage',
  'warranty',
]);

function normalizeAxisKey(axis: string) {
  return axis
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[\s.-]+/g, '_');
}

export function canonicalizeCommerceVariantAxis(axis: string): string | null {
  const normalized = normalizeAxisKey(axis);
  const canonical = COMMERCE_VARIANT_AXIS_ALIASES[normalized] ?? normalized;
  return COMMERCE_VARIANT_AXES.has(canonical) ? canonical : null;
}

function normalizeGraphicsOption(value: string) {
  const model = value.match(/\b((?:RTX|GTX)\s*\d{3,4}(?:\s*(?:Ti|Super))?)\b/i);
  const memory = value.match(/\b(\d+)\s*GB\b/i);
  if (!(model && memory)) {
    return value;
  }

  const normalizedModel = model[1]
    ?.replace(/\s+/g, ' ')
    .toUpperCase()
    .replace(/TI\b/, 'Ti')
    .replace(/SUPER\b/, 'Super');
  return `NVIDIA GeForce ${normalizedModel} ${memory[1]}GB`;
}

export function normalizeCommerceVariantOption(axis: string, value: unknown) {
  const canonicalAxis = canonicalizeCommerceVariantAxis(axis);
  if (!canonicalAxis || typeof value !== 'string') {
    return '';
  }

  let normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    return '';
  }

  if (canonicalAxis === 'graphics') {
    normalized = normalizeGraphicsOption(normalized);
  } else if (canonicalAxis === 'processor') {
    normalized = normalized.replace(/\bIntel\s+Ultra\b/i, 'Intel Core Ultra');
  } else if (canonicalAxis === 'ram') {
    normalized = normalized.replace(/\s+RAM$/i, '');
  } else if (canonicalAxis === 'storage') {
    normalized = normalized.replace(
      /^(\d+(?:\.\d+)?\s*(?:GB|TB))\s+(?:SSD|HDD)$/i,
      '$1'
    );
  }

  return normalized;
}

function getDeclarationKeys(source: unknown): string[] {
  if (Array.isArray(source)) {
    return source.flatMap((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return [];
      }

      const record = entry as Record<string, unknown>;
      const key =
        typeof record.key === 'string'
          ? record.key
          : typeof record.param === 'string'
            ? record.param
            : typeof record.name === 'string'
              ? record.name
              : null;
      return key ? [key] : [];
    });
  }

  if (!source || typeof source !== 'object') {
    return [];
  }

  return Object.keys(source as Record<string, unknown>);
}

export function getCommerceVariantAxes(
  declaration: unknown,
  fallbackAxes: readonly string[] = []
): string[] {
  const normalizeAxes = (axes: readonly string[]) => {
    const seen = new Set<string>();
    return axes.flatMap((axis) => {
      const canonical = canonicalizeCommerceVariantAxis(axis);
      if (!canonical || seen.has(canonical)) {
        return [];
      }

      seen.add(canonical);
      return [canonical];
    });
  };
  const declaredAxes = normalizeAxes(getDeclarationKeys(declaration));
  const fallbackCommerceAxes = normalizeAxes(fallbackAxes);
  return [...new Set([...declaredAxes, ...fallbackCommerceAxes])];
}

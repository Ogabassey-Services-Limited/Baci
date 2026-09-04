const COMMERCE_VARIANT_AXIS_ALIASES: Record<string, string> = {
  colour: 'color',
  gpu: 'graphics',
  ram_options: 'ram',
  storage_capacity: 'storage',
};

/**
 * Descriptive / display-only metadata that must never become a purchase axis.
 * Merchant-defined SKU dimensions outside the historical allowlist (material,
 * style, flavor, …) stay selectable.
 */
const NON_COMMERCE_VARIANT_AXIS_METADATA = new Set([
  'availability',
  'availability_note',
  'camera',
  'color_hex',
  'colour_hex',
  'delivery_notice',
  'disclaimer',
  'disclaimers',
  'display_size',
  'display_type',
  'keyboard',
  'model',
  'model_number',
  'note',
  'notes',
  'notice',
  'operating_system',
  'screen_size',
  'warranty_note',
  'wireless',
]);

function normalizeAxisKey(axis: string) {
  return axis
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[\s.-]+/g, '_');
}

function isNonCommerceVariantAxis(canonical: string): boolean {
  if (NON_COMMERCE_VARIANT_AXIS_METADATA.has(canonical)) {
    return true;
  }

  // Nested specification dumps flatten to specs_* and are never purchase axes.
  return canonical === 'specs' || canonical.startsWith('specs_');
}

export function canonicalizeCommerceVariantAxis(axis: string): string | null {
  const normalized = normalizeAxisKey(axis);
  if (!normalized) {
    return null;
  }

  const canonical = COMMERCE_VARIANT_AXIS_ALIASES[normalized] ?? normalized;
  return isNonCommerceVariantAxis(canonical) ? null : canonical;
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

function normalizeCapacityToken(value: string) {
  return value.replace(
    /^(\d+(?:\.\d+)?)\s*(KB|MB|GB|TB)\b/i,
    (_match, amount: string, unit: string) => `${amount}${unit.toUpperCase()}`
  );
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
    normalized = normalizeCapacityToken(normalized.replace(/\s+RAM$/i, ''));
  } else if (canonicalAxis === 'storage' || canonicalAxis === 'capacity') {
    // Preserve SSD/HDD (and similar medium tokens) so distinct SKUs like
    // "1TB SSD" vs "1TB HDD" do not collapse into a single option.
    normalized = normalized.replace(
      /^(\d+(?:\.\d+)?)\s*(KB|MB|GB|TB)(?:\s+(SSD|HDD|NVMe|eMMC))?$/i,
      (_match, amount: string, unit: string, medium: string | undefined) =>
        medium
          ? `${amount}${unit.toUpperCase()} ${medium.toUpperCase()}`
          : `${amount}${unit.toUpperCase()}`
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

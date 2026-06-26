import type {
  NormalizedImportedOrderItem,
  NormalizedImportedShippingAddress,
} from '@/lib/imports/bumpa/bumpa-types';
import { sanitizeText } from '@/lib/sanitize-core';

const CONDITION_PATTERNS = [
  {
    pattern: /\bpremium\s*used\b/i,
    bracketPattern: /(?:\(\s*premium\s*used\s*\)|\[\s*premium\s*used\s*\])/i,
    value: 'Premium Used',
  },
  {
    pattern: /\buk\s*used\b/i,
    bracketPattern: /(?:\(\s*uk\s*used\s*\)|\[\s*uk\s*used\s*\])/i,
    value: 'UK Used',
  },
  {
    pattern: /\bopen\s*box\b/i,
    bracketPattern: /(?:\(\s*open\s*box\s*\)|\[\s*open\s*box\s*\])/i,
    value: 'Open Box',
  },
  {
    pattern: /\bbrand\s*new\b|\bbrandnew\b/i,
    bracketPattern:
      /(?:\(\s*(?:brand\s*new|brandnew)\s*\)|\[\s*(?:brand\s*new|brandnew)\s*\])/i,
    value: 'New',
  },
  {
    pattern: /\bnew\b/i,
    bracketPattern: /(?:\(\s*new\s*\)|\[\s*new\s*\])/i,
    value: 'New',
  },
  {
    pattern: /\bused\b/i,
    bracketPattern: /(?:\(\s*used\s*\)|\[\s*used\s*\])/i,
    value: 'Used',
  },
] as const;

interface BumpaItemImportMetadata {
  raw_product_name: string;
  normalized_product_name: string;
  analytics_product_key: string;
  product_kind: string;
  brand: string | null;
  product_family: string | null;
  condition: string | null;
  condition_source: string | null;
  fulfillment_identifiers: {
    imeis: string[];
    serialNumbers: string[];
    unlabeledIdentifiers: string[];
  };
}

function optionalText(value: string | null | undefined) {
  const text = sanitizeText(value || '');
  return text || null;
}

function firstOptionalText(...values: (string | null | undefined)[]) {
  for (const value of values) {
    const text = optionalText(value);
    if (text) return text;
  }

  return null;
}

function analyticsKey(value: string) {
  return sanitizeText(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function titleizeMemoryUnits(value: string) {
  return value
    .replace(/\b(\d+)\s*(gb|g)\b/gi, '$1GB')
    .replace(/\b(\d+)\s*tb\b/gi, '$1TB')
    .replace(/\b(\d+)GB\s*\/\s*(\d+)GB\b/gi, '$1GB/$2GB');
}

function normalizeBrandAliases(value: string) {
  let text = value
    .replace(/\biphone\b/gi, 'iPhone')
    .replace(/\bipad\b/gi, 'iPad')
    .replace(/\bmac\s*book\b/gi, 'MacBook')
    .replace(/\bair\s*pods?\b/gi, 'AirPods')
    .replace(/\bphysical\s*sim\b/gi, 'Physical SIM')
    .replace(/\bpremium\s*used\b/gi, 'Premium Used')
    .replace(/\bopen\s*box\b/gi, 'Open Box')
    .replace(/\bhp\b/gi, 'HP')
    .replace(/\bssd\b/gi, 'SSD')
    .replace(/\bhdd\b/gi, 'HDD')
    .replace(/\bram\b/gi, 'RAM')
    .replace(/\bwifi\b/gi, 'WiFi');

  if (/\bpixel\b/i.test(text) && !/\bgoogle\s+pixel\b/i.test(text)) {
    text = text.replace(/\bpixel\b/i, 'Google Pixel');
  }

  return titleizeMemoryUnits(text)
    .replace(/\bxr\b/gi, 'XR')
    .replace(/\bxs\s*max\b/gi, 'Xs Max')
    .replace(/\bpromax\b/gi, 'Pro Max')
    .replace(/\bpro\s*max\b/gi, 'Pro Max');
}

function productKind(value: string) {
  const text = sanitizeText(value).toLowerCase();
  if (/\b(vat|tax)\b/.test(text)) return 'tax_fee';
  if (/\b(delivery|dispatch|shipping)\b/.test(text)) return 'delivery_fee';
  if (/\b(insurance|warranty)\b/.test(text)) return 'protection';
  if (
    // "screengaurd" preserves a Bumpa CSV misspelling seen in exports.
    /\b(screen guard|screen protector|screengaurd|pouch|case|charger|cable|adapter)\b/.test(
      text
    )
  ) {
    return 'accessory';
  }
  if (/\b(airpods|watch)\b/.test(text)) return 'accessory_device';
  if (/\b(repair|service|activation|balance)\b/.test(text)) {
    return 'service_or_adjustment';
  }
  return 'device';
}

function inferBrandFamily(value: string) {
  const text = sanitizeText(value).toLowerCase();
  if (text.includes('iphone')) return { brand: 'Apple', family: 'iPhone' };
  if (text.includes('ipad')) return { brand: 'Apple', family: 'iPad' };
  if (text.includes('macbook')) return { brand: 'Apple', family: 'MacBook' };
  if (text.includes('airpods')) return { brand: 'Apple', family: 'AirPods' };
  if (text.includes('google pixel')) {
    return { brand: 'Google', family: 'Google Pixel' };
  }
  if (text.includes('samsung')) return { brand: 'Samsung', family: 'Samsung' };
  if (text.includes('redmi') || text.includes('xiaomi')) {
    return { brand: 'Xiaomi', family: 'Redmi' };
  }
  if (text.includes('tecno')) return { brand: 'Tecno', family: 'Tecno' };
  if (text.includes('infinix')) return { brand: 'Infinix', family: 'Infinix' };
  if (text.includes('dell')) return { brand: 'Dell', family: 'Dell' };
  if (text.includes('lenovo')) return { brand: 'Lenovo', family: 'Lenovo' };
  if (text.startsWith('hp ') || text.includes(' hp ')) {
    return { brand: 'HP', family: 'HP' };
  }
  if (text.includes('ps5') || text.includes('playstation')) {
    return { brand: 'Sony', family: 'PlayStation' };
  }
  return { brand: null, family: null };
}

function extractCondition(value: string) {
  for (const { bracketPattern, value: condition } of CONDITION_PATTERNS) {
    if (bracketPattern.test(value)) {
      return { condition, conditionSource: 'bracketed' };
    }
  }

  const withoutBracketedText = value.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ');

  for (const { pattern, value: condition } of CONDITION_PATTERNS) {
    if (pattern.test(withoutBracketedText)) {
      return { condition, conditionSource: 'plain' };
    }
  }

  return { condition: null, conditionSource: null };
}

function isDedicatedConditionGroup(value: string) {
  return CONDITION_PATTERNS.some(({ bracketPattern }) =>
    bracketPattern.test(value)
  );
}

function removeBareConditionText(value: string) {
  return value.replace(/\([^)]*\)|\[[^\]]*\]|[^[\]()]+/g, (segment) => {
    if (segment.startsWith('(') || segment.startsWith('[')) {
      return segment;
    }

    return CONDITION_PATTERNS.reduce(
      (text, { pattern }) => text.replace(pattern, ' '),
      segment
    );
  });
}

function removeConditionText(value: string) {
  return sanitizeText(
    removeBareConditionText(
      value.replace(/\([^)]*\)|\[[^\]]*\]/g, (group) =>
        isDedicatedConditionGroup(group) ? ' ' : group
      )
    )
  );
}

function extractIdentifiers(value: string) {
  const imeis = new Set<string>();
  const serialNumbers = new Set<string>();
  const unlabeledIdentifiers = new Set<string>();

  for (const match of value.matchAll(/\bimei\s*[:#-]?\s*([0-9]{14,17})\b/gi)) {
    imeis.add(match[1]);
  }

  for (const match of value.matchAll(
    /\b(?:s\/?n|serial)\s*[:#-]?\s*([A-Z0-9ØO-]{5,})\b/gi
  )) {
    serialNumbers.add(match[1]);
  }

  for (const match of value.matchAll(/\b([0-9]{14,17})\b/g)) {
    const identifier = match[1];
    if (!imeis.has(identifier) && !serialNumbers.has(identifier)) {
      unlabeledIdentifiers.add(identifier);
    }
  }

  return {
    imeis: Array.from(imeis),
    serialNumbers: Array.from(serialNumbers),
    unlabeledIdentifiers: Array.from(unlabeledIdentifiers),
  };
}

function removeIdentifiers(value: string) {
  return sanitizeText(
    value
      .replace(/\[[^\]]*(?:imei|s\/?n|serial)[^\]]*\]/gi, ' ')
      .replace(/\bimei\s*[:#-]?\s*[0-9]{14,17}\b/gi, ' ')
      .replace(/\b(?:s\/?n|serial)\s*[:#-]?\s*[A-Z0-9ØO-]{5,}\b/gi, ' ')
      .replace(/\b[0-9]{14,17}\b/g, ' ')
      .replace(/\b(?:imei|serial|s\/?n)\b\s*[:#-]?\s*$/gi, ' ')
  );
}

function removeContactText(value: string) {
  return sanitizeText(
    value
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, ' ')
      .replace(/\b(?:\+?234|0)?[789][01]\d{8}\b/g, ' ')
  );
}

function buildCleanProductName(itemName: string, useBrandAliases: boolean) {
  const rawProductName = sanitizeText(itemName);
  const { condition } = extractCondition(rawProductName);
  const withoutIdentifiers = removeContactText(
    removeIdentifiers(rawProductName)
  );
  const withoutCondition = removeConditionText(withoutIdentifiers);
  const baseName = (
    useBrandAliases
      ? normalizeBrandAliases(withoutCondition)
      : titleizeMemoryUnits(withoutCondition)
  ).replace(/\s+/g, ' ');
  const kind = productKind(baseName);

  if (condition && (kind === 'device' || kind === 'accessory_device')) {
    return sanitizeText(`${baseName} (${condition})`);
  }

  return sanitizeText(baseName || rawProductName);
}

export function buildBumpaProductNameCandidates(itemName: string) {
  const rawProductName = sanitizeText(itemName);
  const candidates = [
    rawProductName,
    buildCleanProductName(rawProductName, false),
    buildCleanProductName(rawProductName, true),
  ];

  return Array.from(new Set(candidates.filter(Boolean)));
}

export function buildBumpaItemImportMetadata(
  itemName: string
): BumpaItemImportMetadata {
  const rawProductName = sanitizeText(itemName);
  const identifiers = extractIdentifiers(rawProductName);
  const { condition, conditionSource } = extractCondition(rawProductName);
  const normalizedProductName = buildCleanProductName(rawProductName, true);
  const kind = productKind(normalizedProductName);
  const { brand, family } = inferBrandFamily(normalizedProductName);

  return {
    raw_product_name: rawProductName,
    normalized_product_name: normalizedProductName,
    analytics_product_key: analyticsKey(normalizedProductName),
    product_kind: kind,
    brand,
    product_family: family,
    condition,
    condition_source: conditionSource,
    fulfillment_identifiers: identifiers,
  };
}

export function enrichBumpaOrderItems(items: NormalizedImportedOrderItem[]) {
  return items.map((item) => ({
    ...item,
    importMetadata: {
      ...(item.importMetadata ?? {}),
      bumpa: buildBumpaItemImportMetadata(item.productName),
    },
  }));
}

export function buildBumpaShippingAddress(
  rawRow: Record<string, string>
): NormalizedImportedShippingAddress | null {
  const fullAddress = firstOptionalText(
    rawRow.best_address_full,
    rawRow.bumpa_shipping_full_address,
    rawRow.bumpa_customer_full_address
  );
  const address = firstOptionalText(
    rawRow.best_address_street,
    rawRow.bumpa_shipping_street,
    rawRow.bumpa_customer_street
  );
  const city = firstOptionalText(
    rawRow.best_address_city,
    rawRow.bumpa_shipping_city,
    rawRow.bumpa_customer_city
  );
  const state = firstOptionalText(
    rawRow.best_address_state,
    rawRow.bumpa_shipping_state,
    rawRow.bumpa_customer_state
  );
  const country = firstOptionalText(
    rawRow.best_address_country,
    rawRow.bumpa_shipping_country,
    rawRow.bumpa_customer_country
  );
  const postalCode = firstOptionalText(
    rawRow.best_address_zip,
    rawRow.bumpa_shipping_zip,
    rawRow.bumpa_customer_zip
  );

  if (!fullAddress && !address && !city && !state && !country && !postalCode) {
    return null;
  }

  return {
    fullAddress,
    address,
    city,
    state,
    country,
    postalCode,
    source: optionalText(rawRow.address_source) || 'bumpa_import',
  };
}

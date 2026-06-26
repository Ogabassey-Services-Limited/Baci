import { sanitizeText } from '@/lib/sanitize-core';
import { replaceBumpaContactText } from './bumpa-contact-redaction';
import { classifyBumpaProductProfile } from './bumpa-product-taxonomy';

const CONDITION_PATTERNS = [
  {
    pattern: /\bpremium\s*used\b/i,
    bracketPattern: /(?:\(\s*premium\s*used\s*\)|\[\s*premium\s*used\s*\])/i,
    allowMixedGroup: true,
    value: 'Premium Used',
  },
  {
    pattern: /\buk\s*used\b/i,
    bracketPattern: /(?:\(\s*uk\s*used\s*\)|\[\s*uk\s*used\s*\])/i,
    allowMixedGroup: true,
    value: 'UK Used',
  },
  {
    pattern: /\bopen\s*box\b/i,
    bracketPattern: /(?:\(\s*open\s*box\s*\)|\[\s*open\s*box\s*\])/i,
    allowMixedGroup: true,
    value: 'Open Box',
  },
  {
    pattern: /\bbrand\s*new\b|\bbrandnew\b/i,
    bracketPattern:
      /(?:\(\s*(?:brand\s*new|brandnew)\s*\)|\[\s*(?:brand\s*new|brandnew)\s*\])/i,
    allowMixedGroup: true,
    value: 'New',
  },
  {
    pattern: /\bnew\b/i,
    bracketPattern: /(?:\(\s*new\s*\)|\[\s*new\s*\])/i,
    allowMixedGroup: false,
    value: 'New',
  },
  {
    pattern: /\bused\b/i,
    bracketPattern: /(?:\(\s*used\s*\)|\[\s*used\s*\])/i,
    allowMixedGroup: false,
    value: 'Used',
  },
] as const;

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
    .replace(/\b(\d+)\s*gb\b/gi, '$1GB')
    .replace(/\b(\d{2,})\s*g\b/gi, '$1GB')
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
    .replace(/\bxs\s*max\b/gi, 'XS Max')
    .replace(/\bpromax\b/gi, 'Pro Max')
    .replace(/\bpro\s*max\b/gi, 'Pro Max');
}

function extractCondition(value: string) {
  for (const { bracketPattern, value: condition } of CONDITION_PATTERNS) {
    if (bracketPattern.test(value)) {
      return { condition, conditionSource: 'bracketed' };
    }
  }

  const mixedBracketCondition = extractMixedBracketCondition(value);
  if (mixedBracketCondition) return mixedBracketCondition;

  const withoutBracketedText = value.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ');

  for (const { pattern, value: condition } of CONDITION_PATTERNS) {
    if (pattern.test(withoutBracketedText)) {
      return { condition, conditionSource: 'plain' };
    }
  }

  return { condition: null, conditionSource: null };
}

function extractMixedBracketCondition(value: string) {
  for (const match of value.matchAll(/\(([^)]*)\)|\[([^\]]*)\]/g)) {
    const content = match[1] ?? match[2] ?? '';
    for (const conditionPattern of CONDITION_PATTERNS) {
      if (
        conditionPattern.allowMixedGroup &&
        conditionPattern.pattern.test(content)
      ) {
        return {
          condition: conditionPattern.value,
          conditionSource: 'bracketed',
        };
      }
    }
  }

  return null;
}

function isDedicatedConditionGroup(value: string) {
  return CONDITION_PATTERNS.some(({ bracketPattern }) =>
    bracketPattern.test(value)
  );
}

function removeMixedConditionText(value: string) {
  let cleaned = value;
  let changed = false;

  for (const conditionPattern of CONDITION_PATTERNS) {
    if (
      !conditionPattern.allowMixedGroup ||
      !conditionPattern.pattern.test(cleaned)
    ) {
      continue;
    }

    cleaned = cleaned.replace(conditionPattern.pattern, ' ');
    changed = true;
  }

  if (!changed) return null;

  return sanitizeText(cleaned).replace(/^[\s:,\-/]+|[\s:,\-/]+$/g, '');
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
      value.replace(/\([^)]*\)|\[[^\]]*\]/g, (group) => {
        if (isDedicatedConditionGroup(group)) return ' ';

        const mixedConditionText = removeMixedConditionText(group.slice(1, -1));
        return mixedConditionText === null ? group : mixedConditionText || ' ';
      })
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
    /\b(?:s\/?n|serial(?:\s*(?:number|no\.?))?)\s*[:#-]?\s*([A-Z0-9ØO-]{5,})\b/gi
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
      .replace(/\([^)]*(?:imei|s\/?n|serial)[^)]*\)/gi, ' ')
      .replace(/\bimei\s*[:#-]?\s*[0-9]{14,17}\b/gi, ' ')
      .replace(
        /\b(?:s\/?n|serial(?:\s*(?:number|no\.?))?)\s*[:#-]?\s*[A-Z0-9ØO-]{5,}\b/gi,
        ' '
      )
      .replace(/\b[0-9]{14,17}\b/g, ' ')
      .replace(/\(\s*\)|\[\s*\]/g, ' ')
      .replace(
        /\b(?:imei|serial(?:\s*(?:number|no\.?))?|s\/?n)\b\s*[:#-]?\s*$/gi,
        ' '
      )
  );
}

function removeContactText(value: string) {
  return sanitizeText(
    replaceBumpaContactText(value, {
      email: ' ',
      phone: '',
    })
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
  const cleanBaseName = sanitizeText(baseName);
  const kind = classifyBumpaProductProfile(cleanBaseName).productKind;

  if (!cleanBaseName) {
    return condition
      ? sanitizeText(`Unidentified Product (${condition})`)
      : 'Unidentified Product';
  }

  if (condition && (kind === 'device' || kind === 'accessory_device')) {
    return sanitizeText(`${cleanBaseName} (${condition})`);
  }

  return cleanBaseName;
}

export function createBumpaProductProfile(itemName: string) {
  const rawProductName = sanitizeText(itemName);
  const identifiers = extractIdentifiers(rawProductName);
  const { condition, conditionSource } = extractCondition(rawProductName);
  const originalBrandProductName = buildCleanProductName(rawProductName, false);
  const normalizedProductName = buildCleanProductName(rawProductName, true);
  const { productKind, brand, family } = classifyBumpaProductProfile(
    normalizedProductName
  );

  return {
    rawProductName,
    originalBrandProductName,
    normalizedProductName,
    analyticsProductKey: analyticsKey(normalizedProductName),
    productKind,
    brand,
    family,
    condition,
    conditionSource,
    identifiers,
  };
}

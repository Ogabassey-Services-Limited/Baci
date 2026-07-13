import type { PetrockModelScope } from './petrock-device-model';

export const PETROCK_REMEDIATION_LAUNCH_CARRIERS = [
  'AT&T',
  'T-Mobile US',
] as const;

interface ProductInput {
  categoryId: string | null;
  categoryName: string | null;
  fields: readonly { name: string }[];
  name: string;
  priceUsd: number | null;
  productId: string;
  turnaround: string | null;
}

const UNSAFE_PATTERNS: readonly [RegExp, string][] = [
  [
    /unbarr|cleaning|blacklist(?:ed)?(?:\s+imeis?)?\s*[- ]*supported|blacklist removal/i,
    'blacklist_laundering',
  ],
  [
    /reported lost|lost\s*\/\s*stolen|stolen to clean/i,
    'lost_stolen_laundering',
  ],
  [/icloud|\bfmi\b|activation lock/i, 'icloud_bypass'],
  [/\bmdm\b|\bfrp\b/i, 'management_lock_bypass'],
  [/owner info|owner-information|mi account|xiaomi account/i, 'owner_bypass'],
  [/refund request|not .* removal/i, 'non_order_product'],
];

export function normalizePetrockRemediationCarrier(value: string) {
  const normalized = value.toLowerCase();
  if (/at\s*&\s*t|\batt\b/.test(normalized)) return 'AT&T';
  if (/t[- ]?mobile|metro(?:pcs)?|sprint/.test(normalized)) {
    return 'T-Mobile US';
  }
  if (/verizon/.test(normalized)) return 'Verizon';
  if (/vodafone/.test(normalized)) return 'Vodafone UK';
  if (/\bee\b/.test(normalized)) return 'EE UK';
  if (/\bo2\b/.test(normalized)) return 'O2 UK';
  if (/\bthree\b/.test(normalized)) return 'Three UK';
  return null;
}

function parseModelScope(name: string): PetrockModelScope {
  const onlySeries = name.match(/iphone\s*(\d{1,2})\s*series\s*only/i);
  if (onlySeries) {
    const series = Number(onlySeries[1]);
    return { family: 'iphone', kind: 'range', max: series, min: series };
  }
  const upTo = name.match(/(?:up\s*(?:till|to)|through)\s*(\d{1,2})\s*series/i);
  if (upTo) {
    return {
      family: 'iphone',
      kind: 'range',
      max: Number(upTo[1]),
      min: 6,
    };
  }
  if (/all iphone models/i.test(name)) {
    return { family: 'iphone', kind: 'generic' };
  }
  return { kind: 'generic' };
}

function parseStatusSegment(name: string) {
  if (/past due/i.test(name)) return 'past_due';
  if (/account[- ]?locked/i.test(name)) return 'account_locked';
  if (/wait\s*30\s*days/i.test(name)) return 'wait_30_days';
  if (/not active/i.test(name)) return 'not_active';
  if (/\bclean\b/i.test(name)) return 'clean';
  return 'generic';
}

export function parsePetrockRemediationProduct(input: ProductInput) {
  const contractValid =
    input.priceUsd !== null &&
    input.priceUsd > 0 &&
    input.fields.length === 1 &&
    /imei/i.test(input.fields[0]?.name ?? '');
  const productContext = `${input.categoryName ?? ''} ${input.name}`;
  const unsafe = UNSAFE_PATTERNS.find(([pattern]) =>
    pattern.test(productContext)
  );
  const carrier = normalizePetrockRemediationCarrier(productContext);
  const excludedReason = !contractValid
    ? 'invalid_product_contract'
    : (unsafe?.[1] ??
      (!carrier || !/unlock|factory|network/i.test(input.name)
        ? 'unsupported_product'
        : null));
  const successRateMatch = input.name.match(/(\d{1,3}(?:\.\d+)?)\s*%/);

  return {
    carrier,
    categoryId: input.categoryId,
    costUsd: input.priceUsd,
    excludedReason,
    fixtureVerified: false,
    isActive: false,
    launchCarrier: PETROCK_REMEDIATION_LAUNCH_CARRIERS.includes(
      carrier as (typeof PETROCK_REMEDIATION_LAUNCH_CARRIERS)[number]
    ),
    manualDisabled: false,
    modelScope: parseModelScope(input.name),
    orderFieldName: input.fields[0]?.name ?? null,
    productId: input.productId,
    rawName: input.name,
    refundPolicy: /\bno refund\b/i.test(productContext)
      ? 'no_refund_denial'
      : 'refundable',
    reviewStatus: 'pending',
    statusSegment: parseStatusSegment(input.name),
    successRate: successRateMatch ? Number(successRateMatch[1]) : null,
    turnaround: input.turnaround,
  } as const;
}

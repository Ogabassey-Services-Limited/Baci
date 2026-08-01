export interface OgabasseyProductVisibleSummaryOffer {
  active?: boolean | null;
  attributes?: Record<string, unknown> | null;
  condition?: string | null;
  deleted_at?: string | null;
  is_active?: boolean | null;
  status?: string | null;
}

export interface OgabasseyProductVisibleSummaryInput {
  brand?: string | null;
  condition?: string | null;
  name?: string | null;
  variants?: OgabasseyProductVisibleSummaryOffer[] | null;
}

type SummaryAxis =
  | 'storage'
  | 'ram'
  | 'connectivity'
  | 'colour'
  | 'condition';

type SummaryFact = Record<SummaryAxis, string | null>;

const AXIS_PRIORITY: SummaryAxis[] = [
  'storage',
  'ram',
  'connectivity',
  'colour',
  'condition',
];

const AXIS_LABELS: Record<SummaryAxis, string> = {
  storage: 'Storage',
  ram: 'RAM',
  connectivity: 'Connectivity',
  colour: 'Colour',
  condition: 'Condition',
};

const AXIS_ALIASES: Record<Exclude<SummaryAxis, 'condition'>, string[]> = {
  storage: ['storage'],
  ram: ['ram'],
  connectivity: ['connectivity'],
  colour: ['color', 'colour'],
};

function normalizeWhitespace(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function normalizeCondition(value: unknown) {
  const normalized = normalizeWhitespace(value).toLowerCase().replace(/[- ]+/g, '_');
  const labels: Record<string, string> = {
    new: 'New',
    open_box: 'Open Box',
    refurbished: 'Refurbished',
    used: 'Used',
  };

  return labels[normalized] || null;
}

function normalizeCapacity(value: string) {
  const match = value.match(/^(\d+(?:\.\d+)?)\s*(kb|mb|gb|tb)$/i);
  return match ? `${match[1]} ${match[2].toUpperCase()}` : value;
}

function normalizeDisplayValue(axis: Exclude<SummaryAxis, 'condition'>, value: unknown) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return null;

  if (axis === 'storage' || axis === 'ram') {
    return normalizeCapacity(normalized);
  }

  if (axis === 'connectivity') {
    const upper = normalized.toUpperCase();
    return upper === 'WI-FI' ? 'Wi-Fi' : upper;
  }

  return normalized
    .split(' ')
    .map((part) => {
      const lower = part.toLowerCase();
      return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
    })
    .join(' ');
}

function getAttributeAxisValue(
  attributes: Record<string, unknown> | null | undefined,
  axis: Exclude<SummaryAxis, 'condition'>
) {
  const entries = Object.entries(attributes || {}).flatMap(([key, value]) => {
    const normalizedKey = key.trim().toLowerCase().replace(/[\s-]+/g, '_');
    return AXIS_ALIASES[axis].includes(normalizedKey) ? [value] : [];
  });
  const normalizedValues = Array.from(
    new Set(
      entries
        .map((value) => normalizeDisplayValue(axis, value))
        .filter((value): value is string => Boolean(value))
    )
  );

  return normalizedValues.length === 1 ? normalizedValues[0] : null;
}

function hasConflictingConditionAliases(
  attributes: Record<string, unknown> | null | undefined
) {
  const aliases = Object.entries(attributes || {}).flatMap(([key, value]) =>
    key.trim().toLowerCase().replace(/[\s-]+/g, '_') === 'condition'
      ? [normalizeCondition(value)]
      : []
  );

  return (
    aliases.some((value) => !value) ||
    new Set(aliases.filter((value): value is string => Boolean(value))).size > 1
  );
}

function getOfferFacts(
  offer: OgabasseyProductVisibleSummaryOffer,
  parentCondition: string | null
): SummaryFact {
  return {
    storage: getAttributeAxisValue(offer.attributes, 'storage'),
    ram: getAttributeAxisValue(offer.attributes, 'ram'),
    connectivity: getAttributeAxisValue(offer.attributes, 'connectivity'),
    colour: getAttributeAxisValue(offer.attributes, 'colour'),
    condition: hasConflictingConditionAliases(offer.attributes)
      ? null
      : (normalizeCondition(offer.condition) || parentCondition),
  };
}

function isSelectable(offer: OgabasseyProductVisibleSummaryOffer) {
  return (
    offer.active !== false &&
    offer.is_active !== false &&
    offer.deleted_at == null &&
    (offer.status == null || offer.status === 'active')
  );
}

function buildIdentity(brand: unknown, name: unknown) {
  const normalizedBrand = normalizeWhitespace(brand);
  const normalizedName = normalizeWhitespace(name);
  if (!normalizedBrand || !normalizedName) return null;

  return normalizedName.toLowerCase().startsWith(normalizedBrand.toLowerCase())
    ? normalizedName
    : `${normalizedBrand} ${normalizedName}`;
}

function formatValues(values: string[]) {
  return values.join(' or ');
}

export function buildOgabasseyProductVisibleSummary({
  brand,
  condition,
  name,
  variants,
}: OgabasseyProductVisibleSummaryInput) {
  const identity = buildIdentity(brand, name);
  if (!identity) return null;

  const selectableVariants = (variants || []).filter(isSelectable);
  const parentOffer: OgabasseyProductVisibleSummaryOffer = { condition };
  const parentCondition = normalizeCondition(condition);
  const includesParentCondition =
    selectableVariants.length > 0 && Boolean(parentCondition);
  const selectable =
    selectableVariants.length > 0
      ? [
          ...(includesParentCondition ? [parentOffer] : []),
          ...selectableVariants,
        ]
      : [parentOffer];
  const facts = selectable.map((offer) => getOfferFacts(offer, parentCondition));
  const sharedFacts: string[] = [];
  const choiceFacts: string[] = [];

  for (const axis of AXIS_PRIORITY) {
    const factsForAxis =
      includesParentCondition && axis !== 'condition'
        ? facts.slice(1)
        : facts;
    const values = factsForAxis.map((fact) => fact[axis]);
    if (values.some((value) => !value)) continue;

    const uniqueValues = Array.from(new Set(values as string[])).sort((left, right) =>
      left.localeCompare(right, 'en', { sensitivity: 'base' })
    );
    const label = AXIS_LABELS[axis];

    if (uniqueValues.length === 1) {
      sharedFacts.push(`${label}: ${uniqueValues[0]}.`);
    } else if (choiceFacts.length < 3) {
      choiceFacts.push(`${label} ${formatValues(uniqueValues)}.`);
    }
  }

  if (sharedFacts.length === 0 && choiceFacts.length === 0) return null;

  const factsText = [
    ...sharedFacts,
    ...(choiceFacts.length > 0
      ? [`Available choices: ${choiceFacts.join(' ')}`]
      : []),
  ].join(' ');

  return `${identity}. ${factsText}`;
}

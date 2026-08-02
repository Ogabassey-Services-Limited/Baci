import { getKeySpecCategoriesForFamily } from '@/lib/storefront-specs/spec-category-families';
import type {
  ComparableProductKeySpecs,
  SpecField,
} from '@/lib/storefront-specs/spec-taxonomy';
import {
  getProductSpecFamily,
  KEY_SPEC_CATEGORIES,
} from '@/lib/storefront-specs/spec-taxonomy';
import type {
  ProductSemanticCandidate,
  ProductSemanticModel,
  ProductSemanticSection,
} from './product-semantic-types';

const GAMING_CATEGORY_PATTERN =
  /(playstation|nintendo|xbox|gaming|vr|gift-card|gift-cards)/i;
const COMPUTER_CATEGORY_PATTERN = /(laptop|desktop|monitor|computer|tablet)/i;
const MOBILE_CATEGORY_PATTERN = /(smartphone|phone|watch|audio|soundbar|tv)/i;
const METADATA_SPEC_KEYS = new Set([
  'id',
  'product_id',
  'merchant_id',
  'created_at',
  'updated_at',
  'deleted_at',
]);
const ALL_SPEC_FIELDS_BY_KEY = new Map<string, SpecField>(
  KEY_SPEC_CATEGORIES.flatMap((category) => category.fields).map((field) => [
    field.key,
    field,
  ])
);
const GENERIC_UNSUPPORTED_VALUES = new Set([
  '',
  'false',
  'no',
  'n/a',
  'na',
  'none',
  'not applicable',
  'not available',
  'not listed',
  'not published',
  'not supported',
  'unsupported',
  'unavailable',
]);

interface BuildProductContextParagraphsInput {
  categoryName: string;
  categorySlug: string;
  currentProduct: ProductSemanticCandidate;
  displayPriceText?: string | null;
  merchantBusinessName: string;
  semanticModel?: Pick<
    ProductSemanticModel,
    'alternatives' | 'guideLinks' | 'sameBrand' | 'samePrice' | 'supportLinks'
  >;
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeCondition(value: string | null | undefined) {
  const normalized = normalizeText(value);
  return normalized
    ? normalized
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
    : null;
}

function normalizeSpecValue(value: unknown): string | null {
  if (typeof value === 'string') return normalizeText(value);
  if (typeof value === 'number')
    return Number.isFinite(value) ? `${value}` : null;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    const normalizedItems = value
      .map((item) => normalizeSpecValue(item))
      .filter((item): item is string => Boolean(item));
    return normalizedItems.length > 0 ? normalizedItems.join(', ') : null;
  }

  return null;
}

function isGenericUnsupportedValue(value: unknown) {
  if (typeof value === 'boolean') return !value;
  if (typeof value === 'number') return value === 0;
  if (typeof value !== 'string') return false;

  const normalized = value.trim().toLowerCase();
  return (
    GENERIC_UNSUPPORTED_VALUES.has(normalized) ||
    normalized.startsWith('not published') ||
    normalized.startsWith('not listed') ||
    normalized.startsWith('confirm exact')
  );
}

function humanizeSpecKey(key: string) {
  const normalizedKey = key.toLowerCase();
  const exactLabels: Record<string, string> = {
    battery_mah: 'battery',
    display_resolution: 'display resolution',
    main_camera_mp: 'main camera',
    ram_gb: 'RAM',
    storage_gb: 'storage',
  };

  if (normalizedKey in exactLabels) {
    return exactLabels[normalizedKey];
  }

  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\bgb\b/gi, 'GB')
    .replace(/\bmp\b/gi, 'MP')
    .trim();
}

function buildSpecFacts(
  productKeySpecs: Record<string, unknown> | null | undefined,
  categoryName: string
) {
  if (!productKeySpecs) return [];

  const comparableSpecs = productKeySpecs as ComparableProductKeySpecs;
  const family = getProductSpecFamily(categoryName);
  const fieldsByKey = new Map<string, SpecField>(
    getKeySpecCategoriesForFamily(family)
      .flatMap((category) => category.fields)
      .map((field) => [field.key, field])
  );

  return Object.entries(productKeySpecs)
    .flatMap(([key, value]) => {
      if (METADATA_SPEC_KEYS.has(key)) return [];

      const field = fieldsByKey.get(key);
      if (family !== 'general' && !field) return [];
      if (family === 'general' && ALL_SPEC_FIELDS_BY_KEY.has(key)) return [];
      if (field?.condition && !field.condition(comparableSpecs)) return [];
      if (family === 'general' && isGenericUnsupportedValue(value)) return [];

      const scalarValue = normalizeSpecValue(value);
      if (!scalarValue) return [];

      const normalized = field?.transform
        ? normalizeText(field.transform(value, comparableSpecs))
        : scalarValue;
      if (!normalized) return [];

      const label =
        field?.dynamicLabel?.(comparableSpecs) ||
        field?.label ||
        humanizeSpecKey(key);
      return [`${label}: ${normalized}`];
    })
    .slice(0, 5);
}

function buildCategoryChecklist(categorySlug: string, categoryName: string) {
  if (COMPUTER_CATEGORY_PATTERN.test(categorySlug)) {
    return `For ${categoryName} products, compare the processor or panel class, RAM and storage where applicable, port selection, included accessories, operating-system requirements, warranty terms and upgrade limits. Confirm the exact configuration shown on the retail box because laptop, desktop and monitor variants can share similar names while shipping with different specifications.`;
  }

  if (GAMING_CATEGORY_PATTERN.test(categorySlug)) {
    return `For ${categoryName} items, check the platform generation, disc, cartridge or digital-code format, region compatibility, age rating, storage or update requirements, and whether online multiplayer, DLC or subscriptions are needed. Accessories should also be checked against the exact console model and included cable or adapter requirements.`;
  }

  if (MOBILE_CATEGORY_PATTERN.test(categorySlug)) {
    return `For ${categoryName} products, confirm the exact model, color, storage or size option, network or device compatibility, charging requirements, included accessories and warranty terms. Audio, TV, phone and smartwatch variants can differ by region, so the final checkout selection should match the retail unit you intend to receive.`;
  }

  return `For ${categoryName} products, review the exact model, condition, variant, package contents, compatibility notes, warranty terms and delivery requirements before checkout. Category pages can contain similar-looking items, so the structured specs and selected options should be used to confirm the final retail unit.`;
}

function buildAvailabilitySentence(stock: number | null | undefined) {
  if (stock != null && stock <= 0) {
    return 'Availability should be rechecked because this item may currently be out of stock.';
  }

  return 'Live stock, selected options and delivery timing should still be confirmed at checkout.';
}

function hasSectionCards(section: ProductSemanticSection | null | undefined) {
  return Boolean(section?.cards.length);
}

function joinList(parts: string[]) {
  if (parts.length <= 1) {
    return parts[0] ?? '';
  }

  return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}

function buildPricePhrase(displayPriceText: string | null | undefined) {
  const cleanPrice = normalizeText(displayPriceText);

  return cleanPrice
    ? `with pricing shown on this page as ${cleanPrice}`
    : 'with pricing shown on this page';
}

function buildComparisonSentence({
  categoryLabel,
  comparisonSubject,
  merchantName,
  productName,
  semanticModel,
}: {
  categoryLabel: string;
  comparisonSubject: string;
  merchantName: string;
  productName: string;
  semanticModel?: BuildProductContextParagraphsInput['semanticModel'];
}) {
  const renderedSections = [
    semanticModel?.supportLinks.length ? 'comparison links' : '',
    semanticModel?.guideLinks.length ? 'buyer guides' : '',
    hasSectionCards(semanticModel?.sameBrand) ? 'same-brand options' : '',
    hasSectionCards(semanticModel?.samePrice)
      ? 'similar-price alternatives'
      : '',
    hasSectionCards(semanticModel?.alternatives)
      ? `${categoryLabel.toLowerCase()} alternatives`
      : '',
  ].filter(Boolean);

  if (renderedSections.length === 0) {
    return `For buyers comparing ${comparisonSubject}, use the visible details on this page to compare ${productName} with relevant options from ${merchantName}.`;
  }

  return `For buyers comparing ${comparisonSubject}, use the ${joinList(
    renderedSections
  )} on this page to move from ${productName} to relevant options from ${merchantName}.`;
}

export function buildProductContextParagraphs({
  categoryName,
  categorySlug,
  currentProduct,
  displayPriceText,
  merchantBusinessName,
  semanticModel,
}: BuildProductContextParagraphsInput): string[] {
  const productName = normalizeText(currentProduct.name) ?? 'This product';
  const merchantName = normalizeText(merchantBusinessName) ?? 'this store';
  const categoryLabel = normalizeText(categoryName) ?? 'this category';
  const slugForChecklist = normalizeText(categorySlug) ?? categoryLabel;
  const brandName = normalizeText(currentProduct.brand);
  const condition = normalizeCondition(currentProduct.condition);
  const conditionPhrase = condition
    ? `${condition} condition`
    : 'the listed condition';
  const comparisonSubject = brandName
    ? `${brandName} options`
    : `${categoryLabel.toLowerCase()} alternatives`;
  const specFacts = buildSpecFacts(
    currentProduct.product_key_specs,
    categoryLabel
  );

  const paragraphs = [
    `${productName} is listed by ${merchantName} in ${categoryLabel}, ${buildPricePhrase(
      displayPriceText
    )}. Use this product page to review ${conditionPhrase}, compare the exact item details, and verify practical purchase details before checkout. ${buildAvailabilitySentence(
      currentProduct.stock
    )}`,
    `${buildComparisonSentence({
      categoryLabel,
      comparisonSubject,
      merchantName,
      productName,
      semanticModel,
    })} ${buildCategoryChecklist(slugForChecklist, categoryLabel)}`,
  ];

  if (specFacts.length > 0) {
    paragraphs.push(
      `The structured product details currently highlight ${specFacts.join(', ')}. Use these facts together with the product images, selected variant and checkout availability to confirm that this is the correct configuration for your device, console, workspace or entertainment setup.`
    );
  }

  return paragraphs;
}

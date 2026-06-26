import type {
  ProductSemanticCandidate,
  ProductSemanticModel,
  ProductSemanticSection,
} from './product-semantic-types';

interface BuildProductContextParagraphsInput {
  categoryName: string;
  currentProduct: ProductSemanticCandidate;
  displayPriceText?: string | null;
  merchantBusinessName: string;
  semanticModel?: Pick<
    ProductSemanticModel,
    'alternatives' | 'guideLinks' | 'sameBrand' | 'samePrice' | 'supportLinks'
  >;
}

function cleanText(value: string | null | undefined) {
  return value?.replace(/\s+/g, ' ').trim() || '';
}

function toTitleCase(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function buildAvailabilitySentence(stock: number | null | undefined) {
  if (stock != null && stock <= 0) {
    return 'Check the page for current availability before planning checkout.';
  }

  return 'Check the page for current availability, delivery, and checkout options.';
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
  const cleanPrice = cleanText(displayPriceText);

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
  currentProduct,
  displayPriceText,
  merchantBusinessName,
  semanticModel,
}: BuildProductContextParagraphsInput): [string, string] {
  const productName = cleanText(currentProduct.name) || 'This product';
  const merchantName = cleanText(merchantBusinessName) || 'this store';
  const categoryLabel = cleanText(categoryName) || 'this category';
  const brandName = cleanText(currentProduct.brand);
  const condition = cleanText(currentProduct.condition);
  const conditionPhrase = condition
    ? `${toTitleCase(condition)} condition`
    : 'the listed condition';

  const comparisonSubject = brandName
    ? `${brandName} options`
    : `${categoryLabel.toLowerCase()} alternatives`;

  return [
    `${productName} is listed by ${merchantName} in ${categoryLabel}, ${buildPricePhrase(
      displayPriceText
    )}. Use this product page to review ${conditionPhrase}, compare the key details, and decide whether it fits your budget before checkout.`,
    `${buildComparisonSentence({
      categoryLabel,
      comparisonSubject,
      merchantName,
      productName,
      semanticModel,
    })} ${buildAvailabilitySentence(currentProduct.stock)}`,
  ];
}

import { formatCurrencyCompact } from '@/lib/currency';
import type { ProductSemanticCandidate } from './product-semantic-types';

interface BuildProductContextParagraphsInput {
  categoryName: string;
  /** Falls back to NG when the merchant country is not available. */
  countryCode?: string | null;
  currentProduct: ProductSemanticCandidate;
  merchantBusinessName: string;
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

export function buildProductContextParagraphs({
  categoryName,
  countryCode,
  currentProduct,
  merchantBusinessName,
}: BuildProductContextParagraphsInput): [string, string] {
  const productName = cleanText(currentProduct.name) || 'This product';
  const merchantName = cleanText(merchantBusinessName) || 'this store';
  const categoryLabel = cleanText(categoryName) || 'this category';
  const brandName = cleanText(currentProduct.brand);
  const condition = cleanText(currentProduct.condition);
  const conditionPhrase = condition
    ? `${toTitleCase(condition)} condition`
    : 'the listed condition';
  const price = formatCurrencyCompact(
    currentProduct.price,
    countryCode || 'NG'
  );

  const comparisonSubject = brandName
    ? `${brandName} options`
    : `${categoryLabel.toLowerCase()} alternatives`;

  return [
    `${productName} is listed by ${merchantName} in ${categoryLabel}, with the current price shown as ${price}. Use this product page to review ${conditionPhrase}, compare the key details, and decide whether it fits your budget before checkout.`,
    `For buyers comparing ${comparisonSubject}, the related links on this page connect ${productName} with same-brand, similar-price, and category alternatives from ${merchantName}. ${buildAvailabilitySentence(
      currentProduct.stock
    )}`,
  ];
}

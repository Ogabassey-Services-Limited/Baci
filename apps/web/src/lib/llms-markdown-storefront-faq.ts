import type { CachedMerchant } from '@/lib/cached-data';
import type { FAQItem } from '@/types/faq';
import { parseLegacyFAQ } from '@/types/faq';

export type StorefrontFaqSource = Omit<CachedMerchant, 'faq_items'> & {
  faq_items?: unknown;
};

function isFaqItem(item: unknown): item is FAQItem {
  return (
    item !== null &&
    typeof item === 'object' &&
    typeof (item as FAQItem).question === 'string' &&
    typeof (item as FAQItem).answer === 'string'
  );
}

export function getStorefrontFaqItems(
  merchant: StorefrontFaqSource
): FAQItem[] {
  const valid =
    merchant.faq_items && Array.isArray(merchant.faq_items)
      ? merchant.faq_items.filter(isFaqItem)
      : [];

  if (valid.length > 0) {
    return valid;
  }

  if (merchant.pages?.faq) {
    try {
      return parseLegacyFAQ(merchant.pages.faq);
    } catch {
      return [];
    }
  }

  return [];
}

import {
  CATEGORY_HUB_DEFAULTS,
  CATEGORY_HUB_PRIORITY_CATEGORIES,
} from '@/config/category-hub-defaults';
import { countBrandsByActiveProduct } from '@/lib/storefront-category/category-hub-brand-utils';
import type {
  CategoryHubFaqItem,
  CategoryHubIntro,
  CategoryHubProduct,
  CategoryHubSeoInput,
} from '@/lib/storefront-category/category-hub-types';

function isPriorityCategory(categorySlug: string) {
  return CATEGORY_HUB_PRIORITY_CATEGORIES.includes(
    categorySlug as (typeof CATEGORY_HUB_PRIORITY_CATEGORIES)[number]
  );
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function buildFallbackIntro(input: {
  categoryName: string;
  merchantBusinessName: string;
  products: CategoryHubProduct[];
}) {
  const productCount = input.products.length;
  const brands = countBrandsByActiveProduct(input.products)
    .slice(0, 3)
    .map((entry) => entry.label);
  const brandClause = brands.length
    ? ` with leading brands like ${brands.join(', ')}`
    : '';

  return `${input.merchantBusinessName} keeps ${productCount} active products in the ${input.categoryName} category${brandClause}.`;
}

function normalizeSeoFaqItems(
  faqItems: CategoryHubSeoInput['faqs']
): CategoryHubFaqItem[] {
  return (
    faqItems?.filter((item): item is CategoryHubFaqItem =>
      Boolean(
        item &&
          typeof item === 'object' &&
          'question' in item &&
          'answer' in item &&
          isString((item as { question?: unknown }).question) &&
          isString((item as { answer?: unknown }).answer)
      )
    ) ?? []
  );
}

export function resolveCategoryHubContent(input: {
  categorySlug: string;
  categoryName: string;
  merchantBusinessName: string;
  categorySeo?: CategoryHubSeoInput | null;
  products: CategoryHubProduct[];
}) {
  const priorityDefaults = isPriorityCategory(input.categorySlug)
    ? CATEGORY_HUB_DEFAULTS[
        input.categorySlug as keyof typeof CATEGORY_HUB_DEFAULTS
      ]
    : null;
  const merchantHeading = isString(input.categorySeo?.heading)
    ? input.categorySeo?.heading
    : null;
  const merchantDescription = isString(input.categorySeo?.description)
    ? input.categorySeo?.description
    : null;
  const merchantFeatures = input.categorySeo?.features?.filter(isString) ?? [];
  const merchantFaqs = normalizeSeoFaqItems(input.categorySeo?.faqs);
  const hasMerchantIntro = Boolean(merchantHeading || merchantDescription);

  const intro: CategoryHubIntro = hasMerchantIntro
    ? {
        heading:
          merchantHeading ??
          priorityDefaults?.intro.heading ??
          input.categoryName,
        description:
          merchantDescription ?? priorityDefaults?.intro.description ?? '',
        source: 'merchant',
      }
    : priorityDefaults
      ? {
          heading: priorityDefaults.intro.heading,
          description: priorityDefaults.intro.description,
          source: 'curated',
        }
      : {
          heading: input.categoryName,
          description: buildFallbackIntro({
            categoryName: input.categoryName,
            merchantBusinessName: input.merchantBusinessName,
            products: input.products,
          }),
          source: 'fallback',
        };

  const trustFeatures =
    merchantFeatures.length > 0
      ? merchantFeatures
      : (priorityDefaults?.trustFeatures ?? []);
  const faqItems =
    merchantFaqs.length > 0 ? merchantFaqs : (priorityDefaults?.faqItems ?? []);

  return {
    intro,
    trustFeatures,
    faqItems,
  };
}

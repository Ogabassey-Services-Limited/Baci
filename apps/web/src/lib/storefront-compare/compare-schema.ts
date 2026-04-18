import { sanitizeText } from '@/lib/sanitize-core';
import {
  generateBreadcrumbSchema,
  generateFAQSchema,
  getProductUrl,
} from '@/lib/seo-utils';

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface FAQItem {
  question: string;
  answer: string;
}

interface PriceBandSchemaProduct {
  id: string;
  name: string;
  slug: string;
  category: string;
  category_slug: string;
  price: number;
  availability?: 'InStock' | 'OutOfStock';
  image?: string | null;
  description?: string | null;
}

export function buildComparePageSchemas(input: {
  breadcrumbItems: BreadcrumbItem[];
  faqItems: FAQItem[];
}) {
  return {
    breadcrumb: generateBreadcrumbSchema(input.breadcrumbItems),
    faq: input.faqItems.length > 0 ? generateFAQSchema(input.faqItems) : null,
  };
}

export function buildPriceBandPageSchemas(input: {
  breadcrumbItems: BreadcrumbItem[];
  pageName: string;
  pageUrl: string;
  currency: string;
  products: PriceBandSchemaProduct[];
}) {
  return {
    breadcrumb: generateBreadcrumbSchema(input.breadcrumbItems),
    itemList: {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: input.pageName,
      url: input.pageUrl,
      itemListElement: input.products.map((product, index) => {
        const sanitizedDescription = sanitizeText(product.description || '');
        const availability =
          product.availability === 'OutOfStock'
            ? 'https://schema.org/OutOfStock'
            : 'https://schema.org/InStock';

        return {
          '@type': 'ListItem',
          position: index + 1,
          item: {
            '@type': 'Product',
            name: product.name,
            image: product.image || undefined,
            description: sanitizedDescription || undefined,
            url: new URL(getProductUrl(product), input.pageUrl).toString(),
            offers: {
              '@type': 'Offer',
              price: product.price,
              priceCurrency: input.currency,
              availability,
            },
          },
        };
      }),
    },
  };
}

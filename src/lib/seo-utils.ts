import { Product, ProductSchemaMarkup } from './products';
import { escapeHtml, stripHtmlTags } from './sanitize';

/**
 * Generates a URL-friendly slug from the provided text.
 *
 * @returns The input converted to a lowercase, trimmed slug suitable for URLs — spaces replaced by dashes, non-word characters removed, and consecutive dashes collapsed.
 */
export function generateSlug(text: string): string {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')     // Replace spaces with -
        .replace(/[^\w-]+/g, '') // Remove all non-word chars
        .replace(/--+/g, '-')   // Replace multiple - with single -
        .replace(/^-+/, '')       // Trim - from start of text
        .replace(/-+$/, '');      // Trim - from end of text
}

/**
 * Create a URL-friendly product slug that appends a condition suffix when provided.
 *
 * @param name - Product name used as the base for the slug
 * @param condition - Optional condition label (e.g., 'new', 'used'); if omitted the base slug is returned
 * @param conditionDetail - Optional more specific condition (e.g., 'refurbished') that takes precedence over `condition` when present
 * @returns The URL-friendly product slug, with `-<condition>` appended when `condition` or `conditionDetail` is provided
 */
export function generateProductSlug(
    name: string,
    condition?: 'new' | 'used' | string,
    conditionDetail?: string
): string {
    const baseSlug = generateSlug(name);

    // If no condition specified, just use base slug
    if (!condition) {
        return baseSlug;
    }

    // Use condition detail if available (e.g., "refurbished", "premium-used")
    // Otherwise use the condition itself (e.g., "new", "used")
    const conditionSlug = conditionDetail
        ? generateSlug(conditionDetail)
        : generateSlug(condition);

    return `${baseSlug}-${conditionSlug}`;
}

/**
 * Build a product URL path preferring a category prefix when provided.
 *
 * @returns The URL path: `"/{categorySlug}/{productSlug}"` when `category` is present, otherwise `"/products/{productSlug}"`
 */
export function buildProductUrl(
    productSlug: string,
    category?: string | null
): string {
    if (category) {
        const categorySlug = generateSlug(category);
        return `/${categorySlug}/${productSlug}`;
    }
    return `/products/${productSlug}`;
}

/**
 * Build a URL path for the given product by using its slug if present or generating one from its name and condition, falling back to the product id when necessary.
 *
 * @param product - Product data. Uses `slug` if provided; otherwise generates a slug from `name` and optional `condition`/`condition_detail`; falls back to `id`. `category` is used to prefix the path when present.
 * @returns The product URL path (for example, `/category-slug/product-slug` or `/products/product-slug`).
 */
export function getProductUrl(product: {
    slug?: string;
    name: string;
    category?: string | null;
    condition?: 'new' | 'used' | string;
    condition_detail?: string;
    id: string;
}): string {
    // Use existing slug or generate one
    const productSlug = product.slug || generateProductSlug(
        product.name,
        product.condition,
        product.condition_detail
    ) || product.id;

    return buildProductUrl(productSlug, product.category);
}

/**
 * Weight unit mapping to schema.org unit codes
 */
const WEIGHT_UNIT_CODES: Record<string, string> = {
    'kg': 'KGM',
    'lb': 'LBR',
    'g': 'GRM',
    'oz': 'ONZ'
};

/**
 * Dimension unit mapping to schema.org unit codes
 */
const DIMENSION_UNIT_CODES: Record<string, string> = {
    'in': 'INH',
    'm': 'MTR',
    'cm': 'CMT'
};

/**
 * Number of milliseconds in a day
 */
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Number of milliseconds in 30 days
 */
const THIRTY_DAYS_MS = 30 * MILLISECONDS_PER_DAY;

/**
 * Generates JSON-LD structured data for a product (2025 Google best practices)
 * All user-controlled string values are sanitized to prevent XSS attacks.
 * @see https://developers.google.com/search/docs/appearance/structured-data/product
 */
export function generateProductSchema(product: Product, merchantName: string = 'Baci Store', currency: string = 'USD'): ProductSchemaMarkup {
    // Sanitize all user-controlled string values to prevent XSS in JSON-LD context
    const safeName = escapeHtml(product.name);
    const safeDescription = escapeHtml(product.meta_description || product.description);
    const safeBrand = escapeHtml(product.brand || merchantName);
    const safeMerchantName = escapeHtml(merchantName);
    const safeImages = product.images?.map(img => escapeHtml(img.url)) || (product.imageLarge ? [escapeHtml(product.imageLarge)] : []);

    const schema: ProductSchemaMarkup & Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: safeName,
        description: safeDescription,
        image: safeImages,
        brand: {
            '@type': 'Brand',
            name: safeBrand
        },
        offers: {
            '@type': 'Offer',
            price: product.price,
            priceCurrency: currency,
            availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            itemCondition: product.condition === 'used'
                ? 'https://schema.org/UsedCondition'
                : 'https://schema.org/NewCondition',
            seller: {
                '@type': 'Organization',
                name: safeMerchantName
            },
            // Add price valid until (30 days from now for freshness)
            priceValidUntil: new Date(Date.now() + THIRTY_DAYS_MS).toISOString().substring(0, 10)
        }
    };

    // Product identifiers (important for Google Merchant Center) - sanitized
    if (product.sku) {
        schema.sku = escapeHtml(product.sku);
    }

    if (product.gtin) {
        const safeGtin = escapeHtml(product.gtin);
        schema.gtin = safeGtin;
        if (product.gtin.length === 13) {
            schema.gtin13 = safeGtin;
        }
        if (product.gtin.length === 14) {
            schema.gtin14 = safeGtin;
        }
    }

    if (product.mpn) {
        schema.mpn = escapeHtml(product.mpn);
    }

    // Category for Google Product Category - sanitized
    if (product.category) {
        schema.category = escapeHtml(product.category);
    }

    if (product.google_product_category) {
        schema.google_product_category = escapeHtml(product.google_product_category);
    }

    // Physical attributes
    if (product.weight_value && product.weight_unit) {
        schema.weight = {
            '@type': 'QuantitativeValue',
            value: product.weight_value,
            unitCode: WEIGHT_UNIT_CODES[product.weight_unit] || 'KGM'
        };
    }

    // Dimensions
    if (product.dimensions) {
        const dimUnit = DIMENSION_UNIT_CODES[product.dimensions.unit] || 'CMT';
        // Use product.dimensions.depth if available; fallback to length for backwards compatibility.
        // NOTE: Depth and length may represent the same physical dimension depending on historical data models.
        // This fallback ensures older product definitions using 'length' for depth still populate the schema.
        // Consider standardizing on 'depth' in future and updating legacy data accordingly.
        if (product.dimensions.depth) {
            schema.depth = { '@type': 'QuantitativeValue', value: product.dimensions.depth, unitCode: dimUnit };
        } else if (product.dimensions.length) {
            schema.depth = { '@type': 'QuantitativeValue', value: product.dimensions.length, unitCode: dimUnit };
        }
        if (product.dimensions.width) {
            schema.width = { '@type': 'QuantitativeValue', value: product.dimensions.width, unitCode: dimUnit };
        }
        if (product.dimensions.height) {
            schema.height = { '@type': 'QuantitativeValue', value: product.dimensions.height, unitCode: dimUnit };
        }
    }

    // Color (useful for apparel) - sanitized
    if (product.color) {
        schema.color = escapeHtml(product.color);
    }

    // Compare at price (for sales)
    if (product.compare_at_price && product.compare_at_price > product.price && schema.offers) {
        schema.offers.priceSpecification = {
            '@type': 'PriceSpecification',
            price: product.price,
            priceCurrency: currency,
            valueAddedTaxIncluded: product.taxable !== false
        };
    }

    return schema;
}

/**
 * Generates breadcrumb JSON-LD schema (2025 best practices)
 * All user-controlled string values are sanitized to prevent XSS attacks.
 * @see https://developers.google.com/search/docs/appearance/structured-data/breadcrumb
 */
export interface BreadcrumbItem {
    name: string;
    url: string;
}

export function generateBreadcrumbSchema(items: BreadcrumbItem[]): Record<string, unknown> {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: escapeHtml(item.name),
            item: escapeHtml(item.url)
        }))
    };
}

/**
 * Generates FAQ schema for product pages with Q&A
 * All user-controlled string values are sanitized to prevent XSS attacks.
 * @see https://developers.google.com/search/docs/appearance/structured-data/faqpage
 */
export interface FAQItem {
    question: string;
    answer: string;
}

export function generateFAQSchema(faqs: FAQItem[]): Record<string, unknown> {
    return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map(faq => ({
            '@type': 'Question',
            name: escapeHtml(faq.question),
            acceptedAnswer: {
                '@type': 'Answer',
                text: escapeHtml(faq.answer)
            }
        }))
    };
}

/**
 * Generates LocalBusiness schema for merchant storefronts
 * All user-controlled string values are sanitized to prevent XSS attacks.
 * @see https://developers.google.com/search/docs/appearance/structured-data/local-business
 */
export interface LocalBusinessData {
    name: string;
    description?: string;
    url: string;
    logo?: string;
    telephone?: string;
    email?: string;
    address?: {
        street?: string;
        city?: string;
        state?: string;
        postalCode?: string;
        country?: string;
    };
    geo?: {
        latitude: number;
        longitude: number;
    };
    openingHours?: string[]; // e.g., ["Mo-Fr 09:00-17:00", "Sa 10:00-14:00"]
    priceRange?: string; // e.g., "$$" or "₦₦"
    socialMedia?: Record<string, string>;
}

export function generateLocalBusinessSchema(business: LocalBusinessData): Record<string, unknown> {
    const schema: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'Store',
        name: escapeHtml(business.name),
        url: escapeHtml(business.url),
    };

    if (business.description) {
        schema.description = escapeHtml(business.description);
    }

    if (business.logo) {
        const safeLogo = escapeHtml(business.logo);
        schema.logo = safeLogo;
        schema.image = safeLogo;
    }

    if (business.telephone) {
        schema.telephone = escapeHtml(business.telephone);
    }

    if (business.email) {
        schema.email = escapeHtml(business.email);
    }

    if (business.address) {
        schema.address = {
            '@type': 'PostalAddress',
            streetAddress: business.address.street ? escapeHtml(business.address.street) : undefined,
            addressLocality: business.address.city ? escapeHtml(business.address.city) : undefined,
            addressRegion: business.address.state ? escapeHtml(business.address.state) : undefined,
            postalCode: business.address.postalCode ? escapeHtml(business.address.postalCode) : undefined,
            addressCountry: escapeHtml(business.address.country || 'NG')
        };
    }

    if (business.geo) {
        schema.geo = {
            '@type': 'GeoCoordinates',
            latitude: business.geo.latitude,
            longitude: business.geo.longitude
        };
    }

    if (business.openingHours) {
        schema.openingHours = business.openingHours.map(h => escapeHtml(h));
    }

    if (business.priceRange) {
        schema.priceRange = escapeHtml(business.priceRange);
    }

    if (business.socialMedia) {
        schema.sameAs = Object.values(business.socialMedia).filter(Boolean).map(url => escapeHtml(url));
    }

    return schema;
}

/**
 * Ellipsis string and length for meta description truncation
 */
const ELLIPSIS = '...';
const ELLIPSIS_LENGTH = ELLIPSIS.length;
const DEFAULT_MAX_LENGTH = 160;

/**
 * Validates and returns a proper maxLength value for meta description truncation.
 */
function validateMaxLength(value: number): number {
    if (typeof value !== 'number' || isNaN(value) || value <= ELLIPSIS_LENGTH) {
        return DEFAULT_MAX_LENGTH;
    }
    return value;
}

/**
 * Generates a meta description from product description if not provided
 */
export function generateMetaDescription(description: string, maxLength: number = DEFAULT_MAX_LENGTH): string {
    if (!description) return '';

    const validMaxLength = validateMaxLength(maxLength);

    // Strip HTML tags using iterative sanitization to prevent incomplete removal
    // of nested patterns like <scr<script>ipt>
    const plainText = stripHtmlTags(description);

    if (plainText.length <= validMaxLength) return plainText;

    return plainText.substring(0, validMaxLength - ELLIPSIS_LENGTH) + ELLIPSIS;
}
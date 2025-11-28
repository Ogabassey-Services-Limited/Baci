import { Product, ProductSchemaMarkup } from './products';
import { escapeHtml, stripHtmlTags, sanitizeSchemaMarkup } from './sanitize';

/**
 * Generates a URL-friendly slug from a string
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
 * Generates a full product slug including condition
 * Examples:
 *   - "iPhone 12" (new) → "iphone-12-new"
 *   - "iPhone 12" (used) → "iphone-12-used"
 *   - "iPhone 12" (refurbished) → "iphone-12-refurbished"
 *   - "iPhone 12" (no condition) → "iphone-12"
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
 * Builds the product URL path based on available data
 * Priority:
 *   1. /{category}/{product-slug} (if category exists)
 *   2. /products/{product-slug} (fallback)
 *
 * Examples:
 *   - smartphones, "iphone-12-used" → "/smartphones/iphone-12-used"
 *   - null, "generic-item" → "/products/generic-item"
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
 * Generates the full product URL path from product data
 * Convenience function combining slug generation and URL building
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

    // Merge custom schema markup if provided (e.g. aggregateRating)
    // This allows merchants to extend the auto-generated schema with their own data
    if (product.schema_markup) {
        const sanitizedCustomSchema = sanitizeSchemaMarkup(product.schema_markup);
        // We merge sanitizedCustomSchema into schema
        // Using Object.assign to override/extend existing fields
        Object.assign(schema, sanitizedCustomSchema);
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

/**
 * Generates CollectionPage schema for product listing pages (categories, collections)
 * @see https://schema.org/CollectionPage
 */
export interface CollectionPageData {
    name: string;
    description?: string;
    url: string;
    products: Product[];
    merchantName: string;
    currency?: string;
}

export function generateCollectionPageSchema(data: CollectionPageData): Record<string, unknown> {
    const safeProducts = data.products.slice(0, 20); // Limit to 20 for performance

    return {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: escapeHtml(data.name),
        description: data.description ? escapeHtml(data.description) : undefined,
        url: escapeHtml(data.url),
        mainEntity: {
            '@type': 'ItemList',
            itemListElement: safeProducts.map((product, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                item: {
                    '@type': 'Product',
                    name: escapeHtml(product.name),
                    description: product.description ? escapeHtml(generateMetaDescription(product.description, 100)) : undefined,
                    image: product.imageLarge ? escapeHtml(product.imageLarge) : undefined,
                    url: escapeHtml(getProductUrl(product)),
                    offers: {
                        '@type': 'Offer',
                        price: product.price,
                        priceCurrency: data.currency || 'NGN',
                        availability: product.stock > 0
                            ? 'https://schema.org/InStock'
                            : 'https://schema.org/OutOfStock'
                    }
                }
            }))
        },
        numberOfItems: data.products.length
    };
}

/**
 * Generates ProductGroup schema for products with variants (colors, sizes, etc.)
 * @see https://schema.org/ProductGroup
 */
export interface ProductGroupData {
    name: string;
    description?: string;
    url: string;
    variants: Product[];
    merchantName: string;
    currency?: string;
    variesBy?: ('color' | 'size' | 'material' | 'pattern')[];
}

export function generateProductGroupSchema(data: ProductGroupData): Record<string, unknown> {
    const schema: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'ProductGroup',
        name: escapeHtml(data.name),
        description: data.description ? escapeHtml(data.description) : undefined,
        url: escapeHtml(data.url),
        productGroupID: escapeHtml(data.name.toLowerCase().replace(/\s+/g, '-')),
        hasVariant: data.variants.map(variant => ({
            '@type': 'Product',
            name: escapeHtml(variant.name),
            description: variant.description ? escapeHtml(generateMetaDescription(variant.description, 100)) : undefined,
            image: variant.imageLarge ? escapeHtml(variant.imageLarge) : undefined,
            sku: variant.sku ? escapeHtml(variant.sku) : undefined,
            color: variant.color ? escapeHtml(variant.color) : undefined,
            offers: {
                '@type': 'Offer',
                price: variant.price,
                priceCurrency: data.currency || 'NGN',
                availability: variant.stock > 0
                    ? 'https://schema.org/InStock'
                    : 'https://schema.org/OutOfStock',
                seller: {
                    '@type': 'Organization',
                    name: escapeHtml(data.merchantName)
                }
            }
        }))
    };

    // Add variesBy property if specified
    if (data.variesBy && data.variesBy.length > 0) {
        schema.variesBy = data.variesBy.map(v =>
            `https://schema.org/${v.charAt(0).toUpperCase() + v.slice(1)}`
        );
    }

    return schema;
}

/**
 * Generates Organization schema for the merchant/store
 * @see https://schema.org/Organization
 */
export interface OrganizationData {
    name: string;
    url: string;
    logo?: string;
    description?: string;
    email?: string;
    telephone?: string;
    socialMedia?: {
        facebook?: string;
        instagram?: string;
        twitter?: string;
        linkedin?: string;
        youtube?: string;
    };
    foundingDate?: string;
}

export function generateOrganizationSchema(data: OrganizationData): Record<string, unknown> {
    const schema: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: escapeHtml(data.name),
        url: escapeHtml(data.url),
    };

    if (data.logo) {
        const safeLogo = escapeHtml(data.logo);
        schema.logo = {
            '@type': 'ImageObject',
            url: safeLogo,
            width: 600,
            height: 60
        };
        schema.image = safeLogo;
    }

    if (data.description) {
        schema.description = escapeHtml(data.description);
    }

    if (data.email) {
        schema.email = escapeHtml(data.email);
    }

    if (data.telephone) {
        schema.telephone = escapeHtml(data.telephone);
    }

    if (data.foundingDate) {
        schema.foundingDate = escapeHtml(data.foundingDate);
    }

    // Collect social media profiles
    const sameAs: string[] = [];
    if (data.socialMedia) {
        if (data.socialMedia.facebook) sameAs.push(escapeHtml(data.socialMedia.facebook));
        if (data.socialMedia.instagram) sameAs.push(escapeHtml(data.socialMedia.instagram));
        if (data.socialMedia.twitter) sameAs.push(escapeHtml(data.socialMedia.twitter));
        if (data.socialMedia.linkedin) sameAs.push(escapeHtml(data.socialMedia.linkedin));
        if (data.socialMedia.youtube) sameAs.push(escapeHtml(data.socialMedia.youtube));
    }

    if (sameAs.length > 0) {
        schema.sameAs = sameAs;
    }

    return schema;
}

/**
 * Generates WebSite schema with SearchAction for sitelinks search box
 * @see https://developers.google.com/search/docs/appearance/structured-data/sitelinks-searchbox
 */
export function generateWebSiteSchema(
    name: string,
    url: string,
    searchUrlTemplate?: string
): Record<string, unknown> {
    const schema: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: escapeHtml(name),
        url: escapeHtml(url),
    };

    // Add search action for sitelinks search box
    if (searchUrlTemplate) {
        schema.potentialAction = {
            '@type': 'SearchAction',
            target: {
                '@type': 'EntryPoint',
                urlTemplate: escapeHtml(searchUrlTemplate)
            },
            'query-input': 'required name=search_term_string'
        };
    }

    return schema;
}

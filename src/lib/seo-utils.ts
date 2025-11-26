import { Product, ProductSchemaMarkup } from './products';

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
 * @see https://developers.google.com/search/docs/appearance/structured-data/product
 */
export function generateProductSchema(product: Product, merchantName: string = 'Baci Store', currency: string = 'USD'): ProductSchemaMarkup {
    const schema: ProductSchemaMarkup & Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        description: product.meta_description || product.description,
        image: product.images?.map(img => img.url) || (product.imageLarge ? [product.imageLarge] : []),
        brand: {
            '@type': 'Brand',
            name: product.brand || merchantName
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
                name: merchantName
            },
            // Add price valid until (30 days from now for freshness)
            priceValidUntil: new Date(Date.now() + THIRTY_DAYS_MS).toISOString().substring(0, 10)
        }
    };

    // Product identifiers (important for Google Merchant Center)
    if (product.sku) {
        schema.sku = product.sku;
    }

    if (product.gtin) {
        schema.gtin = product.gtin;
        if (product.gtin.length === 13) {
            schema.gtin13 = product.gtin;
        }
        if (product.gtin.length === 14) {
            schema.gtin14 = product.gtin;
        }
    }

    if (product.mpn) {
        schema.mpn = product.mpn;
    }

    // Category for Google Product Category
    if (product.category) {
        schema.category = product.category;
    }

    if (product.google_product_category) {
        schema.google_product_category = product.google_product_category;
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

    // Color (useful for apparel)
    if (product.color) {
        schema.color = product.color;
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
            name: item.name,
            item: item.url
        }))
    };
}

/**
 * Generates FAQ schema for product pages with Q&A
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
            name: faq.question,
            acceptedAnswer: {
                '@type': 'Answer',
                text: faq.answer
            }
        }))
    };
}

/**
 * Generates LocalBusiness schema for merchant storefronts
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
        name: business.name,
        url: business.url,
    };

    if (business.description) {
        schema.description = business.description;
    }

    if (business.logo) {
        schema.logo = business.logo;
        schema.image = business.logo;
    }

    if (business.telephone) {
        schema.telephone = business.telephone;
    }

    if (business.email) {
        schema.email = business.email;
    }

    if (business.address) {
        schema.address = {
            '@type': 'PostalAddress',
            streetAddress: business.address.street,
            addressLocality: business.address.city,
            addressRegion: business.address.state,
            postalCode: business.address.postalCode,
            addressCountry: business.address.country || 'NG'
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
        schema.openingHours = business.openingHours;
    }

    if (business.priceRange) {
        schema.priceRange = business.priceRange;
    }

    if (business.socialMedia) {
        schema.sameAs = Object.values(business.socialMedia).filter(Boolean);
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

    // Strip HTML tags if any
    const plainText = description.replace(/<[^>]*>?/gm, '');

    if (plainText.length <= validMaxLength) return plainText;

    return plainText.substring(0, validMaxLength - ELLIPSIS_LENGTH) + ELLIPSIS;
}

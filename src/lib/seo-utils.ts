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
        .replace(/[^\w\-]+/g, '') // Remove all non-word chars
        .replace(/\-\-+/g, '-')   // Replace multiple - with single -
        .replace(/^-+/, '')       // Trim - from start of text
        .replace(/-+$/, '');      // Trim - from end of text
}

/**
 * Generates JSON-LD structured data for a product
 */
export function generateProductSchema(product: Product, merchantName: string = 'Baci Store', currency: string = 'USD'): ProductSchemaMarkup {
    const schema: ProductSchemaMarkup = {
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
            availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'
        }
    };

    if (product.sku) {
        (schema as any).sku = product.sku;
    }

    if (product.gtin) {
        (schema as any).gtin = product.gtin;
    }

    if (product.mpn) {
        (schema as any).mpn = product.mpn;
    }

    if (product.weight_value && product.weight_unit) {
        (schema as any).weight = {
            '@type': 'QuantitativeValue',
            value: product.weight_value,
            unitCode: product.weight_unit === 'kg' ? 'KGM' : 'LBR' // Simplified mapping
        };
    }

    if (product.condition) {
        (schema as any).itemCondition = product.condition === 'new'
            ? 'https://schema.org/NewCondition'
            : 'https://schema.org/UsedCondition';
    }

    return schema;
}

/**
 * Generates a meta description from product description if not provided
 */
export function generateMetaDescription(description: string, maxLength: number = 160): string {
    if (!description) return '';

    // Strip HTML tags if any
    const plainText = description.replace(/<[^>]*>?/gm, '');

    if (plainText.length <= maxLength) return plainText;

    return plainText.substring(0, maxLength - 3) + '...';
}

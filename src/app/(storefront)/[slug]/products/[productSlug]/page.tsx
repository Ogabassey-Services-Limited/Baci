import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import ProductDetailClient from './product-detail-client';
import { Product } from '@/lib/products';

// Force dynamic rendering since we rely on URL params and DB data
export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{
        slug: string; // Store slug
        productSlug: string; // Product slug or ID
    }>;
}

async function getProduct(storeSlug: string, productSlug: string) {
    const supabase = createServerComponentClient({ cookies });

    // 1. Get Merchant ID from store slug
    const { data: merchant, error: merchantError } = await supabase
        .from('merchants')
        .select('id, business_name')
        .eq('slug', storeSlug)
        .single();

    if (merchantError || !merchant) {
        console.error('Merchant not found:', merchantError);
        return null;
    }

    // 2. Get Product by slug (or ID) and merchant_id
    // We try to match by slug first, then by ID if it looks like a UUID
    let query = supabase
        .from('products')
        .select('*')
        .eq('merchant_id', merchant.id);

    // Check if productSlug is a UUID (simple regex check)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productSlug);

    if (isUuid) {
        query = query.or(`slug.eq.${productSlug},id.eq.${productSlug}`);
    } else {
        query = query.eq('slug', productSlug);
    }

    const { data: product, error: productError } = await query.single();

    if (productError || !product) {
        console.error('Product not found:', productError);
        return null;
    }

    // Fetch variants if needed (though product table might have them jsonb or separate table)
    // For now, assuming basic product data is enough or variants are fetched client-side or joined
    // If variants are in a separate table, we might need to fetch them.
    // The current `Product` interface has `variants?: ProductVariant[]`.
    // Let's fetch variants if has_variants is true.

    if (product.has_variants) {
        const { data: variants } = await supabase
            .from('product_variants')
            .select('*')
            .eq('product_id', product.id);

        if (variants) {
            product.variants = variants;
        }
    }

    return product as Product;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug, productSlug } = await params;
    const product = await getProduct(slug, productSlug);

    if (!product) {
        return {
            title: 'Product Not Found',
            description: 'The product you are looking for does not exist.',
        };
    }

    const headersList = await headers();
    const host = headersList.get('host') || 'baci.app';
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    // If we are on a custom domain or subdomain, the path is just /products/slug
    // If we were on the main site path-based (e.g. baci.app/store/slug), it would be different
    // But middleware rewrites suggest we are at root of the store domain/subdomain
    const canonicalUrl = product.canonical_url || `${baseUrl}/products/${product.slug || product.id}`;

    return {
        title: product.meta_title || `${product.name} | Baci Store`,
        description: product.meta_description || product.description,
        keywords: product.keywords,
        alternates: {
            canonical: canonicalUrl,
        },
        openGraph: {
            title: product.meta_title || product.name,
            description: product.meta_description || product.description,
            images: product.images?.map(img => ({ url: img.url, alt: img.alt })) || [
                {
                    url: product.imageLarge || product.image,
                    width: 800,
                    height: 600,
                    alt: product.name,
                },
            ],
            url: canonicalUrl,
            type: 'website',
        },
        twitter: {
            card: 'summary_large_image',
            title: product.meta_title || product.name,
            description: product.meta_description || product.description,
            images: [product.imageLarge || product.image],
        },
    };
}

export default async function ProductPage({ params }: PageProps) {
    const { slug, productSlug } = await params;
    const product = await getProduct(slug, productSlug);

    if (!product) {
        notFound();
    }

    return <ProductDetailClient product={product} />;
}

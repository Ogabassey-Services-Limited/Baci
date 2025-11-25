import { MerchantProvider } from '@/hooks/use-merchant';
import React from 'react';
import ProductDetailClient from './product-detail-client';
import { getProductById, products, Product, ProductVariant } from '@/lib/products';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers, cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getCategoryConfig } from '@/lib/category-configs';

async function getProduct(id: string): Promise<Product | undefined> {
  // 1. Try fetching from Supabase
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: productData, error } = await supabase
      .from('products')
      .select('*, variants:product_variants(*)')
      .eq('id', id)
      .single();

    if (productData && !error) {
      // Map Supabase result to Product interface
      const categoryConfig = productData.category ? getCategoryConfig(productData.category) : undefined;

      const variants = (productData.variants || []).map((v: any) => ({
        id: v.id,
        product_id: v.product_id,
        merchant_id: v.merchant_id,
        attributes: v.attributes,
        price_override: v.price_override,
        stock_quantity: v.stock_quantity,
        primary_image: v.primary_image,
        images: v.images,
      })) as ProductVariant[];

      return {
        id: productData.id,
        name: productData.name,
        description: productData.description || '',
        status: productData.status as any,
        price: Number(productData.price),
        manage_stock: productData.manage_stock ?? true,
        stock: productData.stock_quantity ?? 0,
        minimum_order_quantity: 1, // Default, as it's not in DB yet
        image: productData.image_small || productData.image_large || '', // Fallback
        imageLarge: productData.image_large || productData.image_small || '',
        imageHint: productData.image_hint || '',
        brand: productData.brand || '', // Might be missing in DB if not added
        gtin: productData.gtin || '',
        mpn: productData.mpn || '',
        category: productData.category,
        fulfillmentFields: categoryConfig?.fulfillmentIdentifiers?.map(id => ({ name: id.label })),

        // New fields
        sku: productData.sku,
        slug: productData.slug,
        compare_at_price: productData.compare_at_price ? Number(productData.compare_at_price) : undefined,
        cost_price: productData.cost_price ? Number(productData.cost_price) : undefined,
        low_stock_threshold: productData.low_stock_threshold,
        images: productData.images,
        condition: productData.condition,
        meta_title: productData.meta_title,
        meta_description: productData.meta_description,

        has_variants: variants.length > 0,
        variants: variants,
      } as Product;
    }
  } catch (error) {
    console.error("Error fetching product from Supabase:", error);
  }

  // 2. Fallback to mock data
  return getProductById(id);
}

// This function generates metadata dynamically on the server
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product) {
    return {
      title: 'Product Not Found',
      description: 'The product you are looking for does not exist.',
    };
  }

  const headersList = await headers();
  const host = headersList.get('host') || 'usebaci.com';
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const storeUrl = `${protocol}://${host}`;

  return {
    title: product.meta_title || `${product.name} | Baci Store`,
    description: product.meta_description || product.description,
    alternates: {
      canonical: product.canonical_url || `${storeUrl}/product/${product.id}`,
    },
    openGraph: {
      title: product.meta_title || product.name,
      description: product.meta_description || product.description,
      images: [
        {
          url: product.imageLarge,
          width: 600,
          height: 400,
          alt: product.name,
        },
      ],
      url: `${storeUrl}/product/${product.id}`,
      type: 'website',
    },
  };
}

export async function generateStaticParams() {
  return products.map((product) => ({
    id: product.id,
  }));
}


// This is the main page component, which is a Server Component.
// Its only job is to get the ID from the URL and render the client component.
export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product) {
    notFound();
  }

  // We need to figure out which merchant this product belongs to.
  // In a real app, you'd fetch the product from DB and it would have a merchant_id.
  // For this mock, we can't know, so we won't pass a slug to MerchantProvider.
  // The hook will then rely on the domain/subdomain, which is what we want.
  return (
    <MerchantProvider>
      <ProductDetailClient product={product} />
    </MerchantProvider>
  );
}

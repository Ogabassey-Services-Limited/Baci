
import { MerchantProvider } from '@/hooks/use-merchant';
import React from 'react';
import ProductDetailClient from './product-detail-client';
import { getProductById, products } from '@/lib/products';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';


// This function generates metadata dynamically on the server
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const product = getProductById(id);

  if (!product) {
    return {
      title: 'Product Not Found',
      description: 'The product you are looking for does not exist.',
    };
  }

  const storeUrl = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'baci.store';

  return {
    title: `${product.name} | Baci Store`,
    description: product.description,
    openGraph: {
      title: product.name,
      description: product.description,
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
  const product = getProductById(id);

  if (!product) {
    notFound();
  }

  return (
    <MerchantProvider>
      <ProductDetailClient product={product} />
    </MerchantProvider>
  );
}

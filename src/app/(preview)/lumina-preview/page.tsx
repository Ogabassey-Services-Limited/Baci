'use client';

import { useState } from 'react';
import { LuminaProductGrid } from '@/components/storefront/lumina';
import type { Product } from '@/lib/products';

// Sample products for preview - matching the actual Product type
const sampleProducts: Product[] = [
  {
    id: '1',
    name: 'iPhone 15 Pro Max',
    slug: 'iphone-15-pro-max',
    description:
      'The most powerful iPhone ever with A17 Pro chip and titanium design.',
    price: 1799000,
    image:
      'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-pro-finish-select-202309-6-1inch-naturaltitanium?wid=400&hei=400',
    imageLarge:
      'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-pro-finish-select-202309-6-1inch-naturaltitanium?wid=800&hei=800',
    imageHint: 'iPhone 15 Pro Max smartphone',
    category: 'Phones',
    brand: 'Apple',
    condition: 'new',
    status: 'active',
    manage_stock: true,
    stock: 50,
    sku: '256GB',
    gtin: '194253401292',
    mpn: 'MU663LL/A',
    variants: [
      {
        id: 'v1',
        product_id: '1',
        merchant_id: 'm1',
        attributes: { color: '#1a1a1a' },
        stock_quantity: 10,
      },
      {
        id: 'v2',
        product_id: '1',
        merchant_id: 'm1',
        attributes: { color: '#f5f5f0' },
        stock_quantity: 15,
      },
      {
        id: 'v3',
        product_id: '1',
        merchant_id: 'm1',
        attributes: { color: '#3d4a5a' },
        stock_quantity: 12,
      },
      {
        id: 'v4',
        product_id: '1',
        merchant_id: 'm1',
        attributes: { color: '#c9b8a4' },
        stock_quantity: 13,
      },
    ],
    images: [
      {
        url: 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-pro-finish-select-202309-6-1inch-blacktitanium?wid=400&hei=400',
        alt: 'Black Titanium',
        order: 0,
      },
      {
        url: 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-pro-finish-select-202309-6-1inch-whitetitanium?wid=400&hei=400',
        alt: 'White Titanium',
        order: 1,
      },
      {
        url: 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-pro-finish-select-202309-6-1inch-bluetitanium?wid=400&hei=400',
        alt: 'Blue Titanium',
        order: 2,
      },
      {
        url: 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-pro-finish-select-202309-6-1inch-naturaltitanium?wid=400&hei=400',
        alt: 'Natural Titanium',
        order: 3,
      },
    ],
    schema_markup: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: 4.9,
        reviewCount: 1250,
      },
    },
  },
  {
    id: '2',
    name: 'MacBook Pro 14"',
    slug: 'macbook-pro-14',
    description:
      'Supercharged by M3 Pro or M3 Max chip for exceptional performance.',
    price: 2499000,
    image:
      'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/mbp14-spacegray-select-202310?wid=400&hei=400',
    imageLarge:
      'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/mbp14-spacegray-select-202310?wid=800&hei=800',
    imageHint: 'MacBook Pro laptop',
    category: 'Laptops',
    brand: 'Apple',
    condition: 'new',
    status: 'active',
    manage_stock: true,
    stock: 30,
    gtin: '194253938507',
    mpn: 'MTL73LL/A',
    variants: [
      {
        id: 'v5',
        product_id: '2',
        merchant_id: 'm1',
        attributes: { color: '#2e2e2e' },
        stock_quantity: 15,
      },
      {
        id: 'v6',
        product_id: '2',
        merchant_id: 'm1',
        attributes: { color: '#e3e4e5' },
        stock_quantity: 15,
      },
    ],
    images: [
      {
        url: 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/mbp14-spacegray-select-202310?wid=400&hei=400',
        alt: 'Space Gray',
        order: 0,
      },
      {
        url: 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/mbp14-silver-select-202310?wid=400&hei=400',
        alt: 'Silver',
        order: 1,
      },
    ],
    schema_markup: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: 4.8,
        reviewCount: 890,
      },
    },
  },
  {
    id: '3',
    name: 'AirPods Pro 2',
    slug: 'airpods-pro-2',
    description:
      'Active Noise Cancellation, Adaptive Audio, and Personalized Spatial Audio.',
    price: 249000,
    image:
      'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/MQD83?wid=400&hei=400',
    imageLarge:
      'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/MQD83?wid=800&hei=800',
    imageHint: 'AirPods Pro wireless earbuds',
    category: 'Accessories',
    brand: 'Apple',
    condition: 'new',
    status: 'active',
    manage_stock: true,
    stock: 100,
    gtin: '194253397083',
    mpn: 'MQD83AM/A',
    schema_markup: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: 4.7,
        reviewCount: 2100,
      },
    },
  },
  {
    id: '4',
    name: 'PlayStation 5',
    slug: 'playstation-5',
    description: 'Experience lightning-fast loading with ultra-high speed SSD.',
    price: 650000,
    image:
      'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=400&h=400&fit=crop',
    imageLarge:
      'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=800&h=800&fit=crop',
    imageHint: 'PlayStation 5 gaming console',
    category: 'Gaming',
    brand: 'Sony',
    condition: 'new',
    status: 'active',
    manage_stock: true,
    stock: 25,
    gtin: '711719549505',
    mpn: 'CFI-1215A01X',
    schema_markup: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: 4.9,
        reviewCount: 5600,
      },
    },
  },
  {
    id: '5',
    name: 'Samsung Galaxy S24 Ultra',
    slug: 'samsung-galaxy-s24-ultra',
    description:
      'AI-powered features with Galaxy AI and stunning camera system.',
    price: 1399000,
    image:
      'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=400&h=400&fit=crop',
    imageLarge:
      'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=800&h=800&fit=crop',
    imageHint: 'Samsung Galaxy S24 Ultra smartphone',
    category: 'Phones',
    brand: 'Samsung',
    condition: 'new',
    status: 'active',
    manage_stock: true,
    stock: 40,
    gtin: '887276789545',
    mpn: 'SM-S928UZKEXAA',
    variants: [
      {
        id: 'v7',
        product_id: '5',
        merchant_id: 'm1',
        attributes: { color: '#1c1c1c' },
        stock_quantity: 15,
      },
      {
        id: 'v8',
        product_id: '5',
        merchant_id: 'm1',
        attributes: { color: '#8b8b8b' },
        stock_quantity: 15,
      },
      {
        id: 'v9',
        product_id: '5',
        merchant_id: 'm1',
        attributes: { color: '#d4b896' },
        stock_quantity: 10,
      },
    ],
    schema_markup: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: 4.8,
        reviewCount: 3200,
      },
    },
  },
  {
    id: '6',
    name: 'HP LaserJet Pro',
    slug: 'hp-laserjet-pro',
    description:
      'Fast, reliable printing for small businesses and home offices.',
    price: 185000,
    image:
      'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=400&h=400&fit=crop',
    imageLarge:
      'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=800&h=800&fit=crop',
    imageHint: 'HP LaserJet Pro printer',
    category: 'Printers',
    brand: 'HP',
    condition: 'used',
    condition_detail: 'Open Box',
    status: 'active',
    manage_stock: true,
    stock: 8,
    gtin: '193905216321',
    mpn: '3PZ15A#BGJ',
    schema_markup: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: 4.3,
        reviewCount: 450,
      },
    },
  },
  {
    id: '7',
    name: 'Sony WH-1000XM5',
    slug: 'sony-wh-1000xm5',
    description:
      'Industry-leading noise cancellation with exceptional sound quality.',
    price: 350000,
    image:
      'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=400&h=400&fit=crop',
    imageLarge:
      'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=800&h=800&fit=crop',
    imageHint: 'Sony WH-1000XM5 headphones',
    category: 'Accessories',
    brand: 'Sony',
    condition: 'new',
    status: 'active',
    manage_stock: true,
    stock: 60,
    gtin: '027242923089',
    mpn: 'WH1000XM5/B',
    variants: [
      {
        id: 'v10',
        product_id: '7',
        merchant_id: 'm1',
        attributes: { color: '#1a1a1a' },
        stock_quantity: 30,
      },
      {
        id: 'v11',
        product_id: '7',
        merchant_id: 'm1',
        attributes: { color: '#e8e3dc' },
        stock_quantity: 30,
      },
    ],
    schema_markup: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: 4.8,
        reviewCount: 1800,
      },
    },
  },
  {
    id: '8',
    name: 'Dell XPS 15',
    slug: 'dell-xps-15',
    description:
      'Premium laptop with InfinityEdge display and powerful performance.',
    price: 1850000,
    image:
      'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=400&h=400&fit=crop',
    imageLarge:
      'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=800&h=800&fit=crop',
    imageHint: 'Dell XPS 15 laptop',
    category: 'Laptops',
    brand: 'Dell',
    condition: 'used',
    condition_detail: 'Premium Used',
    status: 'active',
    manage_stock: true,
    stock: 5,
    gtin: '884116416784',
    mpn: 'XPS9530-7758SLV-PUS',
    schema_markup: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: 4.5,
        reviewCount: 720,
      },
    },
  },
];

export default function LuminaPreviewPage() {
  const [cartIds, setCartIds] = useState<Set<string>>(new Set());
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());

  const handleAddToCart = (_e: React.MouseEvent, product: Product) => {
    setCartIds((prev) => {
      const next = new Set(prev);
      if (next.has(product.id)) {
        next.delete(product.id);
      } else {
        next.add(product.id);
      }
      return next;
    });
  };

  const handleToggleWishlist = (productId: string) => {
    setWishlistIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <LuminaProductGrid
        products={sampleProducts}
        storeSlug="lumina"
        title="Featured Products"
        showViewAll={true}
        showFilters={true}
        cartProductIds={cartIds}
        wishlistProductIds={wishlistIds}
        onAddToCart={handleAddToCart}
        onToggleWishlist={handleToggleWishlist}
      />
    </div>
  );
}

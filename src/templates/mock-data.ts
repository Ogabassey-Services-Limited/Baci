/**
 * @fileOverview Shared Mock Data for Template Previews
 *
 * This file provides consistent sample data for all templates during development
 * and preview mode. Using shared mock data ensures templates look realistic
 * without requiring database connections.
 *
 * @example
 * ```typescript
 * import { MOCK_PRODUCTS, MOCK_CATEGORIES } from '@/templates/mock-data';
 *
 * <ProductGrid products={MOCK_PRODUCTS} />
 * ```
 */

import type { MerchantData } from '@/hooks/use-merchant';
import type { Product } from '@/lib/products';

// =============================================================================
// MOCK PRODUCTS
// =============================================================================

export const MOCK_PRODUCTS: Product[] = [
  {
    id: 'mock-1',
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
    gtin: '194253401292',
    mpn: 'MU663LL/A',
    condition: 'new',
    status: 'active',
    manage_stock: true,
    stock: 50,
    sku: 'IP15PM-256',
    variants: [
      {
        id: 'v1',
        product_id: 'mock-1',
        merchant_id: 'mock-merchant',
        attributes: { color: '#1a1a1a' },
        stock_quantity: 10,
      },
      {
        id: 'v2',
        product_id: 'mock-1',
        merchant_id: 'mock-merchant',
        attributes: { color: '#f5f5f0' },
        stock_quantity: 15,
      },
    ],
  },
  {
    id: 'mock-2',
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
    gtin: '194253938507',
    mpn: 'MTL73LL/A',
    condition: 'new',
    status: 'active',
    manage_stock: true,
    stock: 30,
    sku: 'MBP14-M3-512',
  },
  {
    id: 'mock-3',
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
    gtin: '194253397083',
    mpn: 'MQD83AM/A',
    condition: 'new',
    status: 'active',
    manage_stock: true,
    stock: 100,
    sku: 'APP2-USB-C',
  },
  {
    id: 'mock-4',
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
    gtin: '711719549505',
    mpn: 'CFI-1215A01X',
    condition: 'new',
    status: 'active',
    manage_stock: true,
    stock: 25,
    sku: 'PS5-DISC',
  },
  {
    id: 'mock-5',
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
    gtin: '887276789545',
    mpn: 'SM-S928UZKEXAA',
    condition: 'new',
    status: 'active',
    manage_stock: true,
    stock: 40,
    sku: 'SGS24U-256',
  },
  {
    id: 'mock-6',
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
    gtin: '027242923089',
    mpn: 'WH1000XM5/B',
    condition: 'new',
    status: 'active',
    manage_stock: true,
    stock: 60,
    sku: 'SONY-XM5',
  },
  {
    id: 'mock-7',
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
    gtin: '884116416784',
    mpn: 'XPS9530-7758SLV-PUS',
    condition: 'used',
    condition_detail: 'Premium Used',
    status: 'active',
    manage_stock: true,
    stock: 5,
    sku: 'DELL-XPS15',
  },
  {
    id: 'mock-8',
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
    gtin: '193905216321',
    mpn: '3PZ15A-BGJ',
    condition: 'used',
    condition_detail: 'Open Box',
    status: 'active',
    manage_stock: true,
    stock: 8,
    sku: 'HP-LJ-PRO',
  },
];

// =============================================================================
// MOCK CATEGORIES
// =============================================================================

export interface MockCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image_url?: string;
  product_count: number;
}

export const MOCK_CATEGORIES: MockCategory[] = [
  {
    id: 'cat-1',
    name: 'Phones',
    slug: 'phones',
    description: 'Latest smartphones and mobile devices',
    product_count: 25,
  },
  {
    id: 'cat-2',
    name: 'Laptops',
    slug: 'laptops',
    description: 'Powerful laptops for work and gaming',
    product_count: 18,
  },
  {
    id: 'cat-3',
    name: 'Accessories',
    slug: 'accessories',
    description: 'Headphones, cases, chargers and more',
    product_count: 42,
  },
  {
    id: 'cat-4',
    name: 'Gaming',
    slug: 'gaming',
    description: 'Consoles, controllers and gaming gear',
    product_count: 15,
  },
  {
    id: 'cat-5',
    name: 'Printers',
    slug: 'printers',
    description: 'Home and office printing solutions',
    product_count: 8,
  },
];

// =============================================================================
// MOCK MERCHANT FACTORIES
// =============================================================================

/**
 * Create a mock merchant with custom overrides
 */
export function createMockMerchant(
  overrides: Partial<MerchantData> = {}
): MerchantData {
  return {
    id: 'mock-merchant',
    user_id: 'mock-user',
    business_name: 'Preview Store',
    business_type: 'GADGETS',
    logo_url: undefined,
    brand_colors: {
      primary: '#3B82F6',
      background: '#FFFFFF',
      accent: '#10B981',
    },
    country: 'NG',
    slug: 'preview-store',
    published_config: null,
    ...overrides,
  };
}

/**
 * Get products by category from mock data
 */
export function getMockProductsByCategory(category: string): Product[] {
  return MOCK_PRODUCTS.filter(
    (p) => p.category?.toLowerCase() === category.toLowerCase()
  );
}

/**
 * Get a single mock product by ID
 */
export function getMockProductById(id: string): Product | undefined {
  return MOCK_PRODUCTS.find((p) => p.id === id);
}

/**
 * Get a single mock product by slug
 */
export function getMockProductBySlug(slug: string): Product | undefined {
  return MOCK_PRODUCTS.find((p) => p.slug === slug);
}

// =============================================================================
// FASHION MOCK DATA (for fashion templates)
// =============================================================================

export const MOCK_FASHION_PRODUCTS: Product[] = [
  {
    id: 'fashion-1',
    name: 'Premium Cotton T-Shirt',
    slug: 'premium-cotton-tshirt',
    description: 'Soft, breathable cotton t-shirt perfect for everyday wear.',
    price: 15000,
    image:
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop',
    imageLarge:
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&h=800&fit=crop',
    imageHint: 'White cotton t-shirt',
    category: 'T-Shirts',
    brand: 'Essentials',
    gtin: '1234567890123',
    mpn: 'TS-WHT-001',
    condition: 'new',
    status: 'active',
    manage_stock: true,
    stock: 100,
    sku: 'TS-WHITE-M',
  },
  {
    id: 'fashion-2',
    name: 'Slim Fit Jeans',
    slug: 'slim-fit-jeans',
    description: 'Classic slim fit jeans with stretch comfort.',
    price: 45000,
    image:
      'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&h=400&fit=crop',
    imageLarge:
      'https://images.unsplash.com/photo-1542272604-787c3835535d?w=800&h=800&fit=crop',
    imageHint: 'Blue denim jeans',
    category: 'Jeans',
    brand: 'Denim Co',
    gtin: '1234567890124',
    mpn: 'JN-SLM-001',
    condition: 'new',
    status: 'active',
    manage_stock: true,
    stock: 75,
    sku: 'JEANS-SLIM-32',
  },
  {
    id: 'fashion-3',
    name: 'Leather Crossbody Bag',
    slug: 'leather-crossbody-bag',
    description: 'Elegant genuine leather bag for everyday essentials.',
    price: 85000,
    image:
      'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&h=400&fit=crop',
    imageLarge:
      'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&h=800&fit=crop',
    imageHint: 'Brown leather crossbody bag',
    category: 'Bags',
    brand: 'Luxe',
    gtin: '1234567890125',
    mpn: 'BG-CRS-001',
    condition: 'new',
    status: 'active',
    manage_stock: true,
    stock: 30,
    sku: 'BAG-CROSS-BRN',
  },
  {
    id: 'fashion-4',
    name: 'Classic Sneakers',
    slug: 'classic-sneakers',
    description: 'Timeless white sneakers that go with everything.',
    price: 55000,
    image:
      'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&h=400&fit=crop',
    imageLarge:
      'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800&h=800&fit=crop',
    imageHint: 'White classic sneakers',
    category: 'Shoes',
    brand: 'Urban Steps',
    gtin: '1234567890126',
    mpn: 'SN-CLS-001',
    condition: 'new',
    status: 'active',
    manage_stock: true,
    stock: 50,
    sku: 'SNKR-WHT-42',
  },
];

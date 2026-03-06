// In a real app, this data would come from a database.
// We are defining it here to be shared across the app.

export interface VariantInventoryItem {
  id: string;
  variant_id: string;
  identifier_type: string; // 'S/N', 'IMEI', 'BATCH', etc.
  identifier_value: string;
  status: 'available' | 'sold' | 'reserved' | 'defective' | 'returned';
  order_id?: string;
  sold_at?: string;
}

export interface ProductImage {
  url: string;
  alt: string;
  order: number;
}

export interface ProductDimensions {
  length?: number;
  width?: number;
  height?: number;
  depth?: number;
  unit: 'cm' | 'in' | 'm';
}

export interface OfferSchema {
  '@type': 'Offer';
  price: number;
  priceCurrency: string;
  availability: string;
  itemCondition?: string;
  seller?: { '@type': 'Organization'; name: string };
  priceValidUntil?: string;
  url?: string;
  priceSpecification?: {
    '@type': 'PriceSpecification';
    price: number;
    priceCurrency: string;
    valueAddedTaxIncluded?: boolean;
  };
  [key: string]: unknown;
}

export interface AggregateOfferSchema {
  '@type': 'AggregateOffer';
  lowPrice: number;
  highPrice: number;
  priceCurrency: string;
  offerCount: number;
  availability?: string;
  [key: string]: unknown;
}

export interface ProductSchemaMarkup {
  '@context': 'https://schema.org';
  '@type': 'Product' | 'ProductGroup';
  name?: string;
  description?: string;
  image?: string[];
  brand?: { '@type': 'Brand'; name: string };
  aggregateRating?: {
    '@type': 'AggregateRating';
    ratingValue: number;
    reviewCount: number;
    bestRating?: number;
    worstRating?: number;
  };
  offers?: OfferSchema | OfferSchema[] | AggregateOfferSchema;
  productGroupID?: string;
  hasVariant?: unknown[];
  variesBy?: string[];
  // Index signature for compatibility with Record<string, unknown>
  // Allows additional schema.org properties (sku, gtin, weight, etc.)
  [key: string]: unknown;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  merchant_id: string;
  attributes: Record<string, string>; // { color: 'Blue', storage: '128GB' }
  price_override?: number;
  cost_price?: number; // New field
  images?: string[];
  primary_image?: string;
  stock_quantity: number;
  sku?: string;
  inventory_items?: VariantInventoryItem[]; // Loaded on demand
}

export interface Review {
  author: string;
  datePublished: string;
  reviewBody: string;
  reviewRating: number;
}

export interface Product {
  id: string;
  merchant_id?: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'archived'; // Updated from published/draft/archived
  price: number;
  manage_stock: boolean;
  stock: number;
  minimum_order_quantity?: number;
  image: string;
  imageLarge: string;
  imageHint: string;
  brand: string;
  gtin: string;
  mpn: string;
  fulfillmentFields?: { name: string }[];
  fulfillment_details?: { key: string; value: string }[];
  // Category TEXT field (legacy, will be deprecated)
  category?: string;
  category_slug?: string;
  // Category FK relationship (new, preferred)
  category_id?: string;
  // Joined category object from Supabase query
  categories?: {
    id?: string;
    name?: string;
    slug?: string;
    parent_id?: string;
  } | null;
  color?: string;

  // New fields
  sku?: string;
  slug?: string;
  compare_at_price?: number;
  cost_price?: number;
  low_stock_threshold?: number; // Default: 5

  // Multiple images
  images?: ProductImage[];

  // Shipping
  weight_value?: number;
  weight_unit?: 'kg' | 'lb' | 'g' | 'oz';
  dimensions?: ProductDimensions;

  // Tax
  taxable?: boolean;
  tax_code?: string;

  // Classification - expanded condition enum (2025 best practice)
  condition?: 'new' | 'used' | 'open_box' | 'refurbished';
  condition_detail?: string; // "Brand New", "Premium Used", etc.

  // Display fields for UI (flattened from schema_markup for convenience)
  rating?: number; // 0-5 star rating, flattened from schema_markup.aggregateRating
  review_count?: number; // Number of reviews, flattened from schema_markup.aggregateRating
  reviews?: Review[]; // Array of reviews for schema markup

  // Denormalized variant attributes for fast UI rendering (auto-populated on save)
  colors?: string[]; // Unique colors from variants, e.g., ["Black", "Silver", "Gold"]
  storage_options?: string[]; // Unique storage options, e.g., ["128GB", "256GB", "512GB"]
  available_sizes?: string[]; // Unique sizes, e.g., ["S", "M", "L", "XL"]

  // Additional attributes
  material?: string;
  size_attribute?: string;
  specs?: string;
  specifications?: {
    category: string;
    items: { label: string; value: string }[];
  }[]; // JSONB structured specs
  // biome-ignore lint/suspicious/noExplicitAny: JSONB specs have dynamic structure
  product_key_specs?: Record<string, any>; // JSONB for key specs (screen_size, ram, etc.)
  warranty?: string;

  // SEO
  meta_title?: string;
  meta_description?: string;
  keywords?: string[];
  canonical_url?: string;
  schema_markup?: ProductSchemaMarkup;

  // Google Merchant Center
  google_product_category?: string;

  // Variant support
  has_variants?: boolean;
  variants?: ProductVariant[];

  // Condition support (Phase 7)
  has_condition_offers?: boolean;
  offers?: {
    id: string;
    condition: 'new' | 'used' | 'open_box' | 'refurbished';
    price: number;
    stock_quantity: number;
    images?: string[];
  }[];
}

export interface CachedProductCategory {
  id?: string;
  name?: string;
  slug?: string;
  parent_id?: string;
}

export interface CachedProductCategoryJoin {
  categories?: CachedProductCategory | null;
}

export interface CachedProductVariantRow {
  id: string;
  product_id?: string | null;
  merchant_id?: string | null;
  attributes?: Record<string, string> | null;
  price_override?: number | string | null;
  cost_price?: number | string | null;
  stock_quantity?: number | null;
  sku?: string | null;
  primary_image?: string | null;
  images?: string[] | null;
}

export interface CachedProductOfferRow {
  id: string;
  condition: Product['condition'];
  price: number | string;
  compare_at_price?: number | string | null;
  stock_quantity: number;
  images?: string[] | null;
  condition_notes?: string | null;
  grade?: string | null;
  status?: string | null;
}

export interface CachedProductRow {
  id: string;
  merchant_id?: string | null;
  name: string;
  description?: string | null;
  status?: Product['status'] | null;
  slug?: string | null;
  price?: number | string | null;
  compare_at_price?: number | string | null;
  base_price?: number | string | null;
  sale_price?: number | string | null;
  manage_stock?: boolean | null;
  track_quantity?: boolean | null;
  stock?: number | null;
  stock_quantity?: number | null;
  quantity?: number | null;
  minimum_order_quantity?: number | null;
  min_order_quantity?: number | null;
  low_stock_threshold?: number | null;
  sku?: string | null;
  brand?: string | null;
  gtin?: string | null;
  mpn?: string | null;
  images?: Array<string | { url: string; alt?: string; order?: number }> | null;
  image_hint?: string | null;
  category?: string | null;
  category_slug?: string | null;
  category_id?: string | null;
  categories?: CachedProductCategory | null;
  product_categories?: CachedProductCategoryJoin[] | null;
  color?: string | null;
  has_variants?: boolean | null;
  variants?: ProductVariant[] | null;
  product_variants?: CachedProductVariantRow[] | null;
  condition?: Product['condition'] | null;
  condition_detail?: string | null;
  colors?: string[] | null;
  storage_options?: string[] | null;
  available_sizes?: string[] | null;
  specifications?: Product['specifications'] | null;
  product_key_specs?: Product['product_key_specs'] | null;
  meta_title?: string | null;
  meta_description?: string | null;
  keywords?: string[] | null;
  canonical_url?: string | null;
  schema_markup?: ProductSchemaMarkup | null;
  google_product_category?: string | null;
  weight_value?: number | string | null;
  weight_unit?: Product['weight_unit'] | null;
  dimensions?: ProductDimensions | null;
  taxable?: boolean | null;
  tax_code?: string | null;
  rating?: number | null;
  review_count?: number | null;
  fulfillmentFields?: Product['fulfillmentFields'];
  fulfillment_fields?: Product['fulfillmentFields'];
  fulfillment_details?: Product['fulfillment_details'];
  has_condition_offers?: boolean | null;
  offers?: CachedProductOfferRow[] | null;
  product_offers?: CachedProductOfferRow[] | null;
  [key: string]: unknown;
}

export interface MapCachedProductOverrides {
  merchantId?: string;
  category?: string;
  category_slug?: string;
  categories?: Product['categories'];
}

function toOptionalNumber(value: number | string | null | undefined) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : undefined;
  }

  return undefined;
}

function normalizeProductImages(
  images: CachedProductRow['images'],
  fallbackAlt: string
) {
  return (
    images?.flatMap((image, index) => {
      if (typeof image === 'string') {
        return image
          ? [
              {
                url: image,
                alt: fallbackAlt,
                order: index,
              },
            ]
          : [];
      }

      if (!image?.url) {
        return [];
      }

      return [
        {
          url: image.url,
          alt: image.alt || fallbackAlt,
          order: image.order ?? index,
        },
      ];
    }) || []
  );
}

function getPrimaryCategory(cachedProduct: CachedProductRow) {
  if (cachedProduct.categories) {
    return cachedProduct.categories;
  }

  return cachedProduct.product_categories?.[0]?.categories || null;
}

function mapProductVariants(
  cachedProduct: CachedProductRow,
  merchantIdOverride?: string
) {
  if (cachedProduct.variants?.length) {
    return cachedProduct.variants;
  }

  return cachedProduct.product_variants?.map((variant) => ({
    id: variant.id,
    product_id: variant.product_id || cachedProduct.id,
    merchant_id:
      variant.merchant_id || merchantIdOverride || cachedProduct.merchant_id || '',
    attributes: variant.attributes || {},
    price_override: toOptionalNumber(variant.price_override),
    cost_price: toOptionalNumber(variant.cost_price),
    stock_quantity: variant.stock_quantity ?? 0,
    sku: variant.sku || undefined,
    primary_image: variant.primary_image || undefined,
    images: variant.images || undefined,
  }));
}

function getFilteredProductOffers(cachedProduct: CachedProductRow) {
  const rawOffers = cachedProduct.product_offers || cachedProduct.offers;

  if (!rawOffers?.length) {
    return undefined;
  }

  const filteredOffers = rawOffers
    .filter(
      (offer) =>
        offer.condition !== cachedProduct.condition &&
        (offer.status ? offer.status === 'active' : true)
    )
    .map((offer) => ({
      ...offer,
      price: toOptionalNumber(offer.price) ?? 0,
      compare_at_price: toOptionalNumber(offer.compare_at_price),
    }));

  return filteredOffers.length > 0
    ? (filteredOffers as Product['offers'])
    : undefined;
}

export function mapCachedProductToProduct(
  cachedProduct: CachedProductRow,
  overrides: MapCachedProductOverrides = {}
): Product {
  const normalizedImages = normalizeProductImages(
    cachedProduct.images,
    cachedProduct.name
  );
  const primaryImage = normalizedImages[0]?.url || '';
  const primaryCategory = overrides.categories || getPrimaryCategory(cachedProduct);
  const variants = mapProductVariants(cachedProduct, overrides.merchantId);
  const category =
    overrides.category || primaryCategory?.name || cachedProduct.category || undefined;
  const categorySlug =
    overrides.category_slug ||
    primaryCategory?.slug ||
    cachedProduct.category_slug ||
    undefined;
  const compareAtPrice =
    toOptionalNumber(cachedProduct.compare_at_price) ??
    (cachedProduct.sale_price
      ? toOptionalNumber(cachedProduct.base_price)
      : undefined);

  // Preserve denormalized storefront fields from the cached row
  // while normalizing the core Product contract below.
  return {
    ...(cachedProduct as unknown as Product),
    merchant_id: cachedProduct.merchant_id || overrides.merchantId || undefined,
    description: cachedProduct.description || '',
    status: cachedProduct.status || 'draft',
    price:
      toOptionalNumber(cachedProduct.price) ??
      toOptionalNumber(cachedProduct.sale_price) ??
      toOptionalNumber(cachedProduct.base_price) ??
      0,
    compare_at_price: compareAtPrice,
    manage_stock:
      cachedProduct.manage_stock ?? cachedProduct.track_quantity ?? false,
    stock:
      cachedProduct.stock ??
      cachedProduct.quantity ??
      cachedProduct.stock_quantity ??
      0,
    minimum_order_quantity:
      cachedProduct.minimum_order_quantity ??
      cachedProduct.min_order_quantity ??
      undefined,
    image: primaryImage,
    imageLarge: primaryImage,
    imageHint: cachedProduct.image_hint || cachedProduct.name,
    brand: cachedProduct.brand || '',
    gtin: cachedProduct.gtin || '',
    mpn: cachedProduct.mpn || '',
    images: normalizedImages,
    category,
    category_slug: categorySlug,
    category_id: cachedProduct.category_id || primaryCategory?.id,
    categories: primaryCategory,
    has_variants: cachedProduct.has_variants ?? (variants?.length ?? 0) > 0,
    variants,
    low_stock_threshold: cachedProduct.low_stock_threshold ?? undefined,
    weight_value: toOptionalNumber(cachedProduct.weight_value),
    weight_unit: cachedProduct.weight_unit || undefined,
    dimensions: cachedProduct.dimensions || undefined,
    taxable: cachedProduct.taxable ?? undefined,
    tax_code: cachedProduct.tax_code || undefined,
    condition: cachedProduct.condition || undefined,
    condition_detail: cachedProduct.condition_detail || undefined,
    colors: cachedProduct.colors || undefined,
    storage_options: cachedProduct.storage_options || undefined,
    available_sizes: cachedProduct.available_sizes || undefined,
    specifications: cachedProduct.specifications || undefined,
    product_key_specs: cachedProduct.product_key_specs || undefined,
    meta_title: cachedProduct.meta_title || undefined,
    meta_description: cachedProduct.meta_description || undefined,
    keywords: cachedProduct.keywords || undefined,
    canonical_url: cachedProduct.canonical_url || undefined,
    schema_markup: cachedProduct.schema_markup || undefined,
    google_product_category: cachedProduct.google_product_category || undefined,
    rating: cachedProduct.rating ?? undefined,
    review_count: cachedProduct.review_count ?? undefined,
    fulfillmentFields:
      cachedProduct.fulfillmentFields ||
      cachedProduct.fulfillment_fields ||
      undefined,
    fulfillment_details: cachedProduct.fulfillment_details || undefined,
    has_condition_offers: cachedProduct.has_condition_offers ?? undefined,
    offers: getFilteredProductOffers(cachedProduct),
  };
}

export const products: Product[] = [
  {
    id: 'p1',
    name: 'Ceramic Mug Set',
    description:
      'A beautiful set of two handmade ceramic mugs, perfect for your morning coffee. Each mug is unique and crafted with care.',
    status: 'active',
    price: 49.99,
    manage_stock: true,
    stock: 120,
    minimum_order_quantity: 2,
    image: 'https://picsum.photos/seed/p1/80/80',
    imageLarge: 'https://picsum.photos/seed/p1/600/400',
    imageHint: 'ceramic mug',
    brand: 'Baci Artisan',
    category: 'Home Goods',
    gtin: '123456789012',
    mpn: 'CM-SET-01',
    fulfillmentFields: [{ name: 'IMEI' }],
  },
  {
    id: 'p2',
    name: 'Minimalist Desk Lamp',
    description:
      'A sleek and modern desk lamp with adjustable brightness. Fits any workspace and provides perfect lighting.',
    status: 'active',
    price: 79.99,
    manage_stock: true,
    stock: 75,
    minimum_order_quantity: 1,
    image: 'https://picsum.photos/seed/p2/80/80',
    imageLarge: 'https://picsum.photos/seed/p2/600/400',
    imageHint: 'desk lamp',
    brand: 'Baci Lighting',
    category: 'Home Goods',
    gtin: '123456789013',
    mpn: 'DL-MIN-02',
  },
  {
    id: 'p3',
    name: 'Organic Cotton Towels',
    description:
      'Set of 3 soft and absorbent towels made from 100% organic cotton. Gentle on your skin and the environment.',
    status: 'archived',
    price: 35.0,
    manage_stock: true,
    stock: 0,
    image: 'https://picsum.photos/seed/p3/80/80',
    imageLarge: 'https://picsum.photos/seed/p3/600/400',
    imageHint: 'cotton towels',
    brand: 'Baci Home',
    category: 'Home Goods',
    gtin: '123456789014',
    mpn: 'TOW-ORG-03',
  },
  {
    id: 'p4',
    name: 'Smart Water Bottle',
    description:
      'A water bottle that tracks your intake and reminds you to stay hydrated throughout the day. Connects to your phone.',
    status: 'draft',
    price: 89.99,
    manage_stock: true,
    stock: 30,
    image: 'https://picsum.photos/seed/p4/80/80',
    imageLarge: 'https://picsum.photos/seed/p4/600/400',
    imageHint: 'water bottle',
    brand: 'Baci Tech',
    category: 'Electronics',
    gtin: '123456789015',
    mpn: 'SWB-04',
  },
  {
    id: 'p5',
    name: 'Leather Journal',
    description:
      'A premium leather-bound journal for your thoughts, dreams, and sketches. Made with high-quality paper.',
    status: 'active',
    price: 25.0,
    manage_stock: false,
    stock: 0,
    image: 'https://picsum.photos/seed/p5/80/80',
    imageLarge: 'https://picsum.photos/seed/p5/600/400',
    imageHint: 'leather journal',
    brand: 'Baci Stationary',
    category: 'Stationery',
    gtin: '123456789016',
    mpn: 'JRN-LTH-05',
  },
];

export const sampleProductsByCategory: Record<string, Product[]> = {
  fashion: [
    {
      ...products[0],
      id: 'fas1',
      name: 'Linen Summer Dress',
      price: 120.0,
      imageHint: 'summer dress',
      category: 'Fashion',
    },
    {
      ...products[1],
      id: 'fas2',
      name: 'Classic Leather Jacket',
      price: 350.0,
      imageHint: 'leather jacket',
      category: 'Fashion',
    },
  ],
  electronics: [
    {
      ...products[3],
      id: 'elec1',
      name: 'Wireless Noise-Cancelling Headphones',
      price: 299.99,
      imageHint: 'headphones',
      category: 'Electronics',
    },
    {
      ...products[1],
      id: 'elec2',
      name: '4K Ultra-HD Monitor',
      price: 450.0,
      imageHint: 'computer monitor',
      category: 'Electronics',
    },
  ],
  'home-goods': [
    {
      ...products[0],
      id: 'home1',
      name: 'Velvet Throw Pillow',
      price: 45.0,
      imageHint: 'throw pillow',
      category: 'Home Goods',
    },
    {
      ...products[1],
      id: 'home2',
      name: 'Acacia Wood Serving Bowl',
      price: 65.0,
      imageHint: 'wood bowl',
      category: 'Home Goods',
    },
  ],
  'health-beauty': [
    {
      ...products[4],
      id: 'hb1',
      name: 'Vitamin C Serum',
      price: 55.0,
      imageHint: 'skincare serum',
      category: 'Health & Beauty',
    },
    {
      ...products[2],
      id: 'hb2',
      name: 'Organic Lavender Bath Bombs',
      price: 25.0,
      imageHint: 'bath bombs',
      category: 'Health & Beauty',
    },
  ],
  handmade: [
    {
      ...products[0],
      id: 'hand1',
      name: 'Hand-poured Soy Candle',
      price: 30.0,
      imageHint: 'soy candle',
      category: 'Handmade',
    },
    {
      ...products[4],
      id: 'hand2',
      name: 'Macrame Wall Hanging',
      price: 75.0,
      imageHint: 'macrame art',
      category: 'Handmade',
    },
  ],
  'food-beverage': [
    {
      ...products[0],
      id: 'food1',
      name: 'Artisanal Sourdough Loaf',
      price: 12.0,
      imageHint: 'sourdough bread',
      category: 'Food & Beverage',
    },
    {
      ...products[1],
      id: 'food2',
      name: 'Cold-Pressed Olive Oil',
      price: 28.0,
      imageHint: 'olive oil',
      category: 'Food & Beverage',
    },
  ],
  other: [
    ...products.slice(0, 2), // Default to first two products for "Other"
  ],
};

export function getProductById(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}

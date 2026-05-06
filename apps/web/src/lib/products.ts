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

export type ProductCondition = 'new' | 'used' | 'open_box' | 'refurbished';

export interface ProductVariant {
  id: string;
  product_id: string;
  merchant_id: string;
  attributes: Record<string, string>; // { color: 'Blue', storage: '128GB' }
  condition?: ProductCondition;
  price_override?: number;
  cost_price?: number; // New field
  images?: string[];
  primary_image?: string;
  stock_quantity: number;
  sku?: string;
  inventory_items?: VariantInventoryItem[]; // Loaded on demand
}

export type ProductVariantModel = 'legacy' | 'sku_matrix';

export type ProductMigrationStatus = 'pending' | 'needs_review' | 'migrated';

export interface Review {
  author: string;
  datePublished: string;
  reviewBody: string;
  reviewRating: number;
}

export interface ProductKeySpecs {
  screen_size_inches?: number;
  refresh_rate_hz?: number;
  chipset?: string;
  ram_gb?: number;
  storage_gb?: number;
  main_camera_mp?: number;
  battery_mah?: number;
  charging_watt?: number;
  has_5g?: boolean;
  android_version?: string;
  network_technology?: string;
  sim_type?: string;
  has_nfc?: boolean;
  wifi_bands?: string;
  bluetooth_version?: string;
  usb_type?: string;
  has_usb_otg?: boolean;
  positioning?: string;
  has_fm_radio?: boolean;
  dimensions_mm?: string;
  weight_g?: number;
  build_materials?: string;
  ip_rating?: string;
  display_type?: string;
  display_resolution?: string;
  display_ppi?: number;
  display_protection?: string;
  display_peak_brightness?: number;
  front_camera_mp?: number;
  front_camera_features?: string;
  front_camera_video?: string;
  rear_camera_features?: string;
  rear_camera_video?: string;
  has_dual_camera?: boolean;
  has_triple_camera?: boolean;
  has_quad_camera?: boolean;
  has_stereo_speakers?: boolean;
  has_headphone_jack?: boolean;
  fingerprint_type?: string;
  sensors?: string;
  battery_removable?: boolean;
  has_wireless_charging?: boolean;
  wireless_charging_watt?: number;
  has_reverse_charging?: boolean;
  cpu_cores?: string;
  gpu?: string;
  has_card_slot?: boolean;
  card_slot_type?: string;
  available_colors?: string;
  model_numbers?: string;
  announced_date?: string;
  release_date?: string;
  [key: string]: unknown;
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
  condition?: ProductCondition;
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
  product_key_specs?: ProductKeySpecs; // JSONB for key specs (screen_size, ram, etc.)
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
  variant_model?: ProductVariantModel;
  migration_status?: ProductMigrationStatus;
  default_variant_id?: string;
  available_conditions?: ProductCondition[];
  min_variant_price?: number;
  max_variant_price?: number;

  // Condition support (Phase 7)
  has_condition_offers?: boolean;
  offers?: {
    id: string;
    condition: ProductCondition;
    price: number;
    stock_quantity: number;
    images?: string[];
  }[];
}

export const PRODUCT_STATUS_ACTIVE = 'active' satisfies Product['status'];

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

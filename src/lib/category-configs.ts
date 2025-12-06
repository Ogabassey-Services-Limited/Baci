/**
 * Category Configuration for Nigerian E-commerce
 *
 * Based on research of common product categories in Nigerian small business e-commerce,
 * this configuration defines variant attributes and fulfillment identifiers per category.
 */

export interface CategoryVariantAttribute {
  key: string;
  label: string;
  type: 'color' | 'select' | 'text' | 'number';
  options?: string[];
  hasImage?: boolean; // If true, each value needs its own image
  required?: boolean;
}

export interface CategoryFulfillmentIdentifier {
  value: string;
  label: string;
  description?: string;
}

/** Journey configuration for product creation experience */
export interface CategoryJourney {
  onboarding?: {
    logoStyle?: string;
    colorScheme?: string;
    additionalSteps?: string[];
  };
  productCreation?: {
    requiredFields?: string[];
    aiDescriptionStyle?: string;
    imageRequirements?: string;
  };
}

export interface CategoryConfig {
  displayName: string;
  description: string;
  supportsVariants: boolean;
  variantAttributes?: CategoryVariantAttribute[];
  fulfillmentIdentifiers?: CategoryFulfillmentIdentifier[];
  exampleProducts?: string[];
  productCategories?: string[]; // Predefined product categories for this business type
  /** Journey configuration for this category type */
  journey?: CategoryJourney;
}

export const CATEGORY_CONFIGS: Record<string, CategoryConfig> = {
  'electronics-gadgets': {
    displayName: 'Electronics & Gadgets',
    description: 'Mobile phones, laptops, home appliances, gaming equipment',
    supportsVariants: true,
    variantAttributes: [
      {
        key: 'color',
        label: 'Color',
        type: 'color',
        hasImage: true,
        required: true,
      },
      {
        key: 'ram',
        label: 'RAM',
        type: 'select',
        options: [
          '2GB',
          '4GB',
          '6GB',
          '8GB',
          '12GB',
          '16GB',
          '18GB',
          '24GB',
          '32GB',
          '48GB',
          '64GB',
          '96GB',
          '128GB',
          '192GB',
          '256GB',
        ],
      },
      {
        key: 'storage',
        label: 'Storage Capacity',
        type: 'select',
        options: [
          '16GB',
          '32GB',
          '64GB',
          '128GB',
          '256GB',
          '512GB',
          '1TB',
          '2TB',
        ],
      },
    ],
    fulfillmentIdentifiers: [
      {
        value: 'S/N',
        label: 'Serial Number',
        description: 'Manufacturer-assigned unique identifier',
      },
      {
        value: 'IMEI',
        label: 'IMEI',
        description: 'For mobile devices (15-digit number)',
      },
      {
        value: 'MAC',
        label: 'MAC Address',
        description: 'For network-enabled devices',
      },
      { value: 'SKU', label: 'SKU', description: 'Stock Keeping Unit' },
    ],
    exampleProducts: [
      'iPhone 14',
      'Samsung Galaxy S23',
      'HP Laptop',
      'PlayStation 5',
    ],
    productCategories: [
      'Smartphones',
      'Laptops',
      'Tablets',
      'Audio',
      'Cameras',
      'Gaming',
      'Wearables',
      'Accessories',
    ],
  },

  'fashion-apparel': {
    displayName: 'Fashion & Apparel',
    description: 'Clothing, footwear, accessories, traditional attire',
    supportsVariants: true,
    variantAttributes: [
      {
        key: 'size',
        label: 'Size',
        type: 'select',
        options: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
        required: true,
      },
      {
        key: 'color',
        label: 'Color',
        type: 'color',
        hasImage: true,
        required: true,
      },
      {
        key: 'material',
        label: 'Material',
        type: 'select',
        options: [
          'Cotton',
          'Polyester',
          'Denim',
          'Leather',
          'Silk',
          'Ankara',
          'Lace',
          'Aso-oke',
        ],
      },
      {
        key: 'pattern',
        label: 'Pattern',
        type: 'select',
        options: ['Plain', 'Striped', 'Floral', 'Geometric', 'Printed'],
      },
    ],
    fulfillmentIdentifiers: [
      {
        value: 'SKU',
        label: 'SKU',
        description: 'Stock Keeping Unit (unique per size-color combo)',
      },
      {
        value: 'BARCODE',
        label: 'Barcode',
        description: 'Product barcode for scanning',
      },
      { value: 'UPC', label: 'UPC', description: 'Universal Product Code' },
    ],
    exampleProducts: [
      'T-Shirt',
      'Ankara Dress',
      'Sneakers',
      'Agbada',
      'Leather Jacket',
    ],
    productCategories: [
      'Tops',
      'Bottoms',
      'Dresses',
      'Outerwear',
      'Footwear',
      'Bags',
      'Jewelry',
      'Accessories',
      'Traditional Wear',
    ],
  },

  'beauty-personal-care': {
    displayName: 'Beauty & Personal Care',
    description: 'Skincare, makeup, haircare, fragrances',
    supportsVariants: true,
    variantAttributes: [
      { key: 'shade', label: 'Shade/Color', type: 'color', hasImage: true },
      {
        key: 'size',
        label: 'Size/Volume',
        type: 'select',
        options: [
          '15ml',
          '30ml',
          '50ml',
          '100ml',
          '200ml',
          '500ml',
          'Travel Size',
          'Full Size',
        ],
      },
      {
        key: 'finish',
        label: 'Finish',
        type: 'select',
        options: ['Matte', 'Glossy', 'Satin', 'Shimmer', 'Dewy'],
      },
      {
        key: 'skin_type',
        label: 'Skin Type',
        type: 'select',
        options: [
          'Normal',
          'Dry',
          'Oily',
          'Combination',
          'Sensitive',
          'All Skin Types',
        ],
      },
    ],
    fulfillmentIdentifiers: [
      {
        value: 'BATCH',
        label: 'Batch Number',
        description: 'Manufacturing batch for quality tracking',
      },
      {
        value: 'LOT',
        label: 'Lot Number',
        description: 'Production lot identifier',
      },
      { value: 'SKU', label: 'SKU', description: 'Stock Keeping Unit' },
    ],
    exampleProducts: [
      'Foundation',
      'Lipstick',
      'Hair Serum',
      'Perfume',
      'Moisturizer',
    ],
    productCategories: [
      'Makeup',
      'Skincare',
      'Haircare',
      'Fragrances',
      'Bath & Body',
      'Nail Care',
      'Tools & Brushes',
    ],
  },

  'health-wellness': {
    displayName: 'Health & Wellness',
    description: 'Supplements, vitamins, fitness products, natural remedies',
    supportsVariants: true,
    variantAttributes: [
      {
        key: 'size',
        label: 'Quantity/Size',
        type: 'select',
        options: [
          '30 Capsules',
          '60 Capsules',
          '90 Capsules',
          '500g',
          '1kg',
          'Small',
          'Medium',
          'Large',
        ],
      },
      {
        key: 'flavor',
        label: 'Flavor',
        type: 'select',
        options: [
          'Unflavored',
          'Chocolate',
          'Vanilla',
          'Strawberry',
          'Mixed Berry',
        ],
      },
    ],
    fulfillmentIdentifiers: [
      {
        value: 'BATCH',
        label: 'Batch Number',
        description: 'Critical for recalls and quality control',
      },
      {
        value: 'LOT',
        label: 'Lot Number',
        description: 'Production lot identifier',
      },
      {
        value: 'EXP_DATE',
        label: 'Expiry Date',
        description: 'Product expiration tracking',
      },
    ],
    exampleProducts: [
      'Detox Tea',
      'Vitamin C',
      'Protein Powder',
      'Fitness Tracker',
    ],
    productCategories: [
      'Supplements',
      'Vitamins',
      'Herbal Products',
      'Fitness Equipment',
      'Wellness Drinks',
      'Weight Management',
    ],
  },

  'groceries-food': {
    displayName: 'Groceries & Packaged Food',
    description: 'Staple foods, spices, snacks, packaged items',
    supportsVariants: true,
    variantAttributes: [
      {
        key: 'weight',
        label: 'Weight/Volume',
        type: 'select',
        options: [
          '100g',
          '250g',
          '500g',
          '1kg',
          '2kg',
          '5kg',
          '250ml',
          '500ml',
          '1L',
        ],
      },
      {
        key: 'packaging',
        label: 'Packaging Type',
        type: 'select',
        options: ['Sachet', 'Bottle', 'Can', 'Pouch', 'Carton', 'Jar'],
      },
    ],
    fulfillmentIdentifiers: [
      {
        value: 'BATCH',
        label: 'Batch Number',
        description: 'Manufacturing batch',
      },
      {
        value: 'MFG_DATE',
        label: 'Manufacturing Date',
        description: 'Production date',
      },
      {
        value: 'EXP_DATE',
        label: 'Expiry Date',
        description: 'Best before date',
      },
    ],
    exampleProducts: [
      'Rice (1kg)',
      'Palm Oil (500ml)',
      'Garri',
      'Groundnut',
      'Spice Mix',
    ],
    productCategories: [
      'Grains & Staples',
      'Oils & Fats',
      'Spices',
      'Snacks',
      'Beverages',
      'Packaged Foods',
      'Fresh Produce',
    ],
  },

  'home-living': {
    displayName: 'Home & Living',
    description: 'Furniture, home decor, kitchen items, cleaning supplies',
    supportsVariants: true,
    variantAttributes: [
      { key: 'color', label: 'Color', type: 'color', hasImage: true },
      {
        key: 'size',
        label: 'Size/Dimensions',
        type: 'select',
        options: ['Small', 'Medium', 'Large', 'Queen', 'King', 'Custom'],
      },
      {
        key: 'material',
        label: 'Material',
        type: 'select',
        options: ['Wood', 'Metal', 'Plastic', 'Glass', 'Fabric', 'Ceramic'],
      },
    ],
    fulfillmentIdentifiers: [
      { value: 'SKU', label: 'SKU', description: 'Stock Keeping Unit' },
      {
        value: 'ITEM_NO',
        label: 'Item Number',
        description: 'Product item identifier',
      },
    ],
    exampleProducts: [
      'Sofa Set',
      'Dining Table',
      'Wall Art',
      'Kitchen Utensils',
      'Bedsheets',
    ],
    productCategories: [
      'Furniture',
      'Decor',
      'Kitchen & Dining',
      'Bedding',
      'Storage',
      'Lighting',
      'Cleaning Supplies',
    ],
  },

  'digital-products': {
    displayName: 'Digital Products',
    description: 'E-books, online courses, templates, software licenses',
    supportsVariants: false,
    fulfillmentIdentifiers: [
      {
        value: 'LICENSE',
        label: 'License Key',
        description: 'Software or course access key',
      },
      {
        value: 'CODE',
        label: 'Activation Code',
        description: 'Product activation code',
      },
      {
        value: 'ORDER_ID',
        label: 'Order ID',
        description: 'Unique order identifier',
      },
    ],
    exampleProducts: [
      'E-book PDF',
      'Online Course',
      'Design Template',
      'Software License',
    ],
    productCategories: [
      'E-books',
      'Courses',
      'Templates',
      'Software',
      'Music & Audio',
      'Graphics',
    ],
  },

  'handmade-crafts': {
    displayName: 'Handmade & Crafts',
    description: 'African artistry, handmade jewelry, custom items',
    supportsVariants: true,
    variantAttributes: [
      { key: 'color', label: 'Color', type: 'color', hasImage: true },
      {
        key: 'size',
        label: 'Size',
        type: 'select',
        options: ['Small', 'Medium', 'Large', 'Custom'],
      },
      { key: 'material', label: 'Material', type: 'text' },
    ],
    fulfillmentIdentifiers: [
      {
        value: 'PIECE_NO',
        label: 'Piece Number',
        description: 'Unique for one-of-a-kind items',
      },
      {
        value: 'ARTIST_ID',
        label: 'Artist ID',
        description: 'Creator identifier',
      },
    ],
    exampleProducts: [
      'Beaded Jewelry',
      'Wood Carving',
      'Hand-painted Art',
      'Ankara Bags',
    ],
    productCategories: [
      'Jewelry',
      'Art & Paintings',
      'Sculptures',
      'Textile Crafts',
      'Leather Goods',
      'Pottery',
      'Custom Items',
    ],
  },

  'pharmaceuticals': {
    displayName: 'Pharmaceuticals & Medical',
    description: 'Pharmacy, medications, medical supplies, and health products',
    supportsVariants: true,
    variantAttributes: [
      {
        key: 'dosage',
        label: 'Dosage',
        type: 'select',
        options: [
          '5mg',
          '10mg',
          '25mg',
          '50mg',
          '100mg',
          '200mg',
          '500mg',
          '1000mg',
        ],
      },
      {
        key: 'quantity',
        label: 'Pack Size',
        type: 'select',
        options: [
          '10 tablets',
          '20 tablets',
          '30 tablets',
          '60 tablets',
          '90 tablets',
          '100ml',
          '200ml',
          '500ml',
        ],
      },
      {
        key: 'form',
        label: 'Form',
        type: 'select',
        options: ['Tablets', 'Capsules', 'Syrup', 'Injection', 'Cream', 'Drops'],
      },
    ],
    fulfillmentIdentifiers: [
      {
        value: 'BATCH',
        label: 'Batch Number',
        description: 'Manufacturing batch for quality tracking',
      },
      {
        value: 'EXP_DATE',
        label: 'Expiry Date',
        description: 'Product expiration date',
      },
      {
        value: 'NAFDAC',
        label: 'NAFDAC Reg No',
        description: 'Nigerian regulatory approval number',
      },
      {
        value: 'MFG_DATE',
        label: 'Manufacturing Date',
        description: 'Production date',
      },
    ],
    exampleProducts: [
      'Paracetamol 500mg',
      'Vitamin C Tablets',
      'First Aid Kit',
      'Blood Pressure Monitor',
    ],
    productCategories: [
      'Prescription Medications',
      'Over-the-Counter',
      'Vitamins & Supplements',
      'First Aid',
      'Medical Devices',
      'Personal Care',
      'Baby Care',
      'Wellness Products',
    ],
  },

  'hair-extensions': {
    displayName: 'Hair & Extensions',
    description: 'Wigs, weaves, bundles, closures, frontals, and hair care products',
    supportsVariants: true,
    variantAttributes: [
      {
        key: 'texture',
        label: 'Texture',
        type: 'select',
        options: [
          'Straight',
          'Body Wave',
          'Deep Wave',
          'Curly',
          'Kinky Curly',
          'Loose Wave',
          'Water Wave',
          'Yaki',
        ],
        required: true,
      },
      {
        key: 'length',
        label: 'Length',
        type: 'select',
        options: [
          '8"',
          '10"',
          '12"',
          '14"',
          '16"',
          '18"',
          '20"',
          '22"',
          '24"',
          '26"',
          '28"',
          '30"',
        ],
        required: true,
      },
      {
        key: 'color',
        label: 'Color',
        type: 'color',
        hasImage: true,
      },
      {
        key: 'density',
        label: 'Density',
        type: 'select',
        options: ['130%', '150%', '180%', '200%', '250%'],
      },
    ],
    fulfillmentIdentifiers: [
      { value: 'SKU', label: 'SKU', description: 'Stock Keeping Unit' },
      {
        value: 'ORIGIN',
        label: 'Hair Origin',
        description: 'Source of the hair (e.g., Brazilian, Peruvian)',
      },
      {
        value: 'GRADE',
        label: 'Hair Grade',
        description: 'Quality grade (e.g., 10A, 12A)',
      },
    ],
    exampleProducts: [
      'Brazilian Body Wave 20"',
      'HD Lace Frontal 13x4',
      '4x4 Closure Straight',
      'Deep Wave Bundles 3pcs',
    ],
    productCategories: [
      'Bundles',
      'Closures',
      'Frontals',
      'Wigs',
      'Ponytails',
      'Clip-ins',
      'Hair Care',
      'Styling Tools',
    ],
  },

  general: {
    displayName: 'General / Other',
    description: "Products that don't fit specific categories",
    supportsVariants: true,
    variantAttributes: [{ key: 'variant', label: 'Variant', type: 'text' }],
    fulfillmentIdentifiers: [
      { value: 'SKU', label: 'SKU', description: 'Stock Keeping Unit' },
      { value: 'ID', label: 'Item ID', description: 'Generic identifier' },
    ],
    exampleProducts: [],
    productCategories: ['Uncategorized', 'Other'],
  },
};

export function getCategoryConfig(categoryKey: string): CategoryConfig {
  return CATEGORY_CONFIGS[categoryKey] || CATEGORY_CONFIGS.general;
}

export function getAllCategories(): string[] {
  return Object.keys(CATEGORY_CONFIGS);
}

export function getVariantCategories(): string[] {
  return Object.entries(CATEGORY_CONFIGS)
    .filter(([, config]) => config.supportsVariants)
    .map(([key]) => key);
}

/**
 * Map from existing business types (from business-types.ts) to category config keys
 * This ensures backward compatibility with existing merchant data
 */
const BUSINESS_TYPE_TO_CATEGORY_MAP: Record<string, string> = {
  fashion: 'fashion-apparel',
  electronics: 'electronics-gadgets',
  'home-goods': 'home-living',
  'health-beauty': 'beauty-personal-care',
  handmade: 'handmade-crafts',
  'food-beverage': 'groceries-food',
  pharmaceuticals: 'pharmaceuticals',
  'hair-extensions': 'hair-extensions',
  other: 'general',
};

/**
 * Get category config based on business type from merchant record
 * @param businessType - The business_type from the merchant record
 * @returns CategoryConfig for that business type
 */
export function getCategoryConfigFromBusinessType(
  businessType: string
): CategoryConfig {
  const categoryKey = BUSINESS_TYPE_TO_CATEGORY_MAP[businessType] || 'general';
  return getCategoryConfig(categoryKey);
}

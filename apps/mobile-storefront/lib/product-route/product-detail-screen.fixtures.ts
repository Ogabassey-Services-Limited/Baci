import type { Product } from '@/types/product';

export const baseProduct: Product = {
  id: 'product-1',
  merchant_id: 'merchant-1',
  name: 'iPhone 13 Pro',
  slug: 'iphone-13-pro',
  price: 552000,
  image: 'https://cdn.example.com/iphone-13-pro.jpg',
  images: ['https://cdn.example.com/iphone-13-pro.jpg'],
};

export const variantProduct: Product = {
  ...baseProduct,
  has_variants: true,
  variant_attributes: {
    storage: ['128GB'],
    connectivity: ['WiFi'],
  },
  variants: [
    {
      id: 'variant-new-128',
      name: '128GB WiFi',
      condition: 'new',
      price: 552000,
      stock_quantity: 5,
      attributes: {
        storage: '128GB',
        connectivity: 'WiFi',
      },
    },
    {
      id: 'variant-used-128',
      name: '128GB WiFi Used',
      condition: 'used',
      price: 500000,
      stock_quantity: 3,
      attributes: {
        storage: '128GB',
        connectivity: 'WiFi',
      },
    },
  ],
};

const variantFixtures = variantProduct.variants ?? [];

if (variantFixtures.length < 2) {
  throw new Error('variantProduct must include at least two variants');
}

export const [primaryVariant, secondaryVariant] = variantFixtures as [
  (typeof variantFixtures)[number],
  (typeof variantFixtures)[number],
];

const iphone11ProMaxColorConfig = {
  Gold: {
    colorHex: '#F5D4A3',
    image: 'https://cdn.example.com/i11pm-gold.jpg',
  },
  'Midnight Green': {
    colorHex: '#4F5C53',
    image: 'https://cdn.example.com/i11pm-midnight-green.jpg',
  },
  Silver: {
    colorHex: '#E5E5E5',
    image: 'https://cdn.example.com/i11pm-silver.jpg',
  },
  'Space Gray': {
    colorHex: '#54524F',
    image: 'https://cdn.example.com/i11pm-space-gray.jpg',
  },
} as const;

type IPhone11ProMaxVariantRow = {
  color: keyof typeof iphone11ProMaxColorConfig;
  condition: 'open_box' | 'used';
  price: number;
  storage: string;
};

const conditionLabels = {
  open_box: 'Open Box',
  used: 'Used',
} as const;

const conditionIdTokens = {
  open_box: 'ob',
  used: 'used',
} as const;

function toVariantIdToken(value: string) {
  return value.toLowerCase().replace(/\s+/g, '-');
}

function createIPhone11ProMaxVariants(rows: IPhone11ProMaxVariantRow[]) {
  return rows.map(({ color, condition, price, storage }) => {
    const { colorHex, image } = iphone11ProMaxColorConfig[color];

    return {
      id: `${conditionIdTokens[condition]}-${toVariantIdToken(color)}-${storage.replace('GB', '')}`,
      name: `${conditionLabels[condition]} ${color} ${storage}`,
      condition,
      stock_quantity: 0,
      price,
      price_override: price,
      image,
      images: [image],
      attributes: {
        color,
        storage,
        color_hex: colorHex,
      },
    };
  });
}

export function iphone11ProMax(): Product {
  return {
    id: 'iphone-11-pro-max',
    merchant_id: 'm-1',
    name: 'iPhone 11 Pro Max',
    slug: 'iphone-11-pro-max',
    price: 520000,
    image: 'https://cdn.example.com/i11pm.jpg',
    images: [
      iphone11ProMaxColorConfig['Midnight Green'].image,
      iphone11ProMaxColorConfig.Silver.image,
      iphone11ProMaxColorConfig['Space Gray'].image,
      iphone11ProMaxColorConfig.Gold.image,
    ],
    condition: 'open_box',
    has_variants: true,
    manage_stock: false,
    stock_quantity: 0,
    variant_attributes: { storage: ['64GB', '256GB', '512GB'] },
    color_images: {},
    colors: ['Midnight Green', 'Silver', 'Space Gray', 'Gold'],
    offers: [],
    variants: createIPhone11ProMaxVariants([
      {
        color: 'Midnight Green',
        condition: 'open_box',
        price: 520000,
        storage: '64GB',
      },
      {
        color: 'Midnight Green',
        condition: 'open_box',
        price: 600000,
        storage: '256GB',
      },
      {
        color: 'Midnight Green',
        condition: 'open_box',
        price: 700000,
        storage: '512GB',
      },
      {
        color: 'Midnight Green',
        condition: 'used',
        price: 470000,
        storage: '64GB',
      },
      {
        color: 'Midnight Green',
        condition: 'used',
        price: 550000,
        storage: '256GB',
      },
      {
        color: 'Midnight Green',
        condition: 'used',
        price: 650000,
        storage: '512GB',
      },
      {
        color: 'Gold',
        condition: 'used',
        price: 470000,
        storage: '64GB',
      },
      {
        color: 'Gold',
        condition: 'open_box',
        price: 520000,
        storage: '64GB',
      },
      {
        color: 'Gold',
        condition: 'used',
        price: 550000,
        storage: '256GB',
      },
      {
        color: 'Gold',
        condition: 'open_box',
        price: 600000,
        storage: '256GB',
      },
      {
        color: 'Gold',
        condition: 'used',
        price: 650000,
        storage: '512GB',
      },
      {
        color: 'Gold',
        condition: 'open_box',
        price: 700000,
        storage: '512GB',
      },
      {
        color: 'Space Gray',
        condition: 'used',
        price: 470000,
        storage: '64GB',
      },
      {
        color: 'Silver',
        condition: 'used',
        price: 470000,
        storage: '64GB',
      },
    ]),
  };
}

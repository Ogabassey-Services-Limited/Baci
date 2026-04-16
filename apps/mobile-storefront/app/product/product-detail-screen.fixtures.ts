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

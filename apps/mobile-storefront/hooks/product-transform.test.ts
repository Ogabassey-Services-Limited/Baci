import { normalizeProductVariants, transformProduct } from './product-transform';

const variantProductRow = {
  id: '953ba6ff-3e83-403a-a07c-8c5ff54ede98',
  name: 'Samsung Galaxy A27 5G Preorder',
  slug: 'samsung-galaxy-a27-5g',
  description: 'Preorder listing',
  price: 50000,
  compare_at_price: null,
  images: [],
  brand: 'Samsung',
  condition: 'new',
  average_rating: 0,
  review_count: 0,
  manage_stock: false,
  stock: 0,
  stock_quantity: 0,
  status: 'active',
  specifications: {
    RAM: '6GB / 8GB',
  },
  has_variants: true,
  variant_model: 'sku_matrix',
  available_conditions: ['new'],
  variant_attributes: [
    { param: 'color', options: ['Blue'] },
    { param: 'storage', options: ['128GB', '256GB'] },
  ],
  variants: [
    {
      id: 'variant-blue-256',
      product_id: '953ba6ff-3e83-403a-a07c-8c5ff54ede98',
      merchant_id: 'merchant-1',
      condition: 'new',
      sku: 'SAMSUNG-A27-5G-PREORDER-BLUE-256GB',
      price_override: 50000,
      primary_image: null,
      images: [],
      stock_quantity: 0,
      attributes: {
        ram: '8GB',
        color: 'Blue',
        storage: '256GB',
        preorder: true,
        color_hex: '#6B86B5',
      },
    },
  ],
  categories: [{ id: 'cat-1', name: 'Smartphones', slug: 'smartphones' }],
};

describe('product-transform', () => {
  it('normalizes live variant attributes to selector strings only', () => {
    expect(
      normalizeProductVariants(variantProductRow.variants, {
        basePrice: variantProductRow.price,
        manageStock: variantProductRow.manage_stock,
      })
    ).toEqual([
      expect.objectContaining({
        attributes: {
          ram: '8GB',
          color: 'Blue',
          storage: '256GB',
          color_hex: '#6B86B5',
        },
        in_stock: true,
        name: '256GB 8GB Blue',
        price: 50000,
      }),
    ]);
  });

  it('transforms live preorder products without keeping boolean variant metadata', () => {
    const product = transformProduct(variantProductRow);

    expect(product).toMatchObject({
      name: 'Samsung Galaxy A27 5G Preorder',
      slug: 'samsung-galaxy-a27-5g',
      variants: [
        expect.objectContaining({
          attributes: {
            ram: '8GB',
            color: 'Blue',
            storage: '256GB',
            color_hex: '#6B86B5',
          },
          price: 50000,
        }),
      ],
    });
    expect(product?.variants?.[0]?.attributes).not.toHaveProperty('preorder');
  });
});

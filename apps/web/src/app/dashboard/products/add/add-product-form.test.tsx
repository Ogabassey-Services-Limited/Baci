import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { Product } from '@/lib/products';

const { mockGetCategoryConfigFromBusinessType, mockVariantBuilder } =
  vi.hoisted(() => ({
    mockGetCategoryConfigFromBusinessType: vi.fn(() => ({
      description: 'Mobile phones, laptops, and accessories',
      displayName: 'Electronics',
      productCategories: ['General', 'Smartphones'],
      supportsVariants: true,
      variantAttributes: [
        {
          key: 'storage',
          label: 'Storage',
          options: ['128GB', '256GB'],
          type: 'select',
        },
      ],
    })),
    mockVariantBuilder: vi.fn<(props: unknown) => string>(
      () => 'VariantBuilder'
    ),
  }));

vi.mock('next/image', () => ({
  default: () => 'img',
}));
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));
vi.mock('@/ai/flows/autofill-product-details', () => ({
  autofillProductDetails: vi.fn(),
}));
vi.mock('@/ai/flows/enhance-product-images', () => ({
  enhanceProductImage: vi.fn(),
}));
vi.mock('@/ai/flows/generate-product-descriptions', () => ({
  generateProductDescription: vi.fn(),
}));
vi.mock('@/components/products/seo-preview', () => ({
  SeoPreview: () => 'SeoPreview',
}));
vi.mock('@/components/products/variant-builder', () => ({
  VariantBuilder: (props: unknown) => mockVariantBuilder(props),
}));
vi.mock('@/components/ui/file-uploader', () => ({
  FileUploader: () => 'FileUploader',
}));
vi.mock('@/components/ui/rich-text-editor', () => ({
  RichTextEditor: () => 'RichTextEditor',
}));
vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchant: vi.fn(() => ({
    merchant: { id: 'm-1', slug: 'test', currency: 'NGN' },
    loading: false,
  })),
}));
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({ upload: vi.fn(), getPublicUrl: vi.fn() })),
    },
  })),
}));
vi.mock('@/env', () => ({
  getRootDomain: vi.fn(() => 'usebaci.com'),
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    NEXT_PUBLIC_ROOT_DOMAIN: 'usebaci.com',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  },
}));
vi.mock('@/lib/category-configs', () => ({
  getCategoryConfigFromBusinessType: mockGetCategoryConfigFromBusinessType,
}));
vi.mock('@/lib/countries', () => ({
  getCountryByCode: vi.fn(() => ({
    name: 'Nigeria',
    code: 'NG',
    currency: 'NGN',
  })),
}));
vi.mock('@/lib/seo-utils', () => ({
  generateSlug: vi.fn((s: string) => s.toLowerCase().replace(/\s+/g, '-')),
}));
vi.mock('@/lib/storage', () => ({
  uploadImage: vi.fn(),
}));

import AddProductForm from './add-product-form';

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class ResizeObserver {
      observe() {
        return undefined;
      }
      unobserve() {
        return undefined;
      }
      disconnect() {
        return undefined;
      }
    }
  );
});

afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  mockGetCategoryConfigFromBusinessType.mockClear();
  mockGetCategoryConfigFromBusinessType.mockImplementation(() => ({
    description: 'Mobile phones, laptops, and accessories',
    displayName: 'Electronics',
    productCategories: ['General', 'Smartphones'],
    supportsVariants: true,
    variantAttributes: [
      {
        key: 'storage',
        label: 'Storage',
        options: ['128GB', '256GB'],
        type: 'select',
      },
    ],
  }));
  mockVariantBuilder.mockClear();
});

describe('AddProductForm', () => {
  it('exports a valid component', () => {
    expect(AddProductForm).toBeDefined();
    expect(typeof AddProductForm).toBe('function');
  });

  it('shows the unlimited stock setting for variant products and passes it to variant stock controls', async () => {
    const user = userEvent.setup();
    const onProductAdded = vi.fn();
    const initialData: Product = {
      brand: 'Apple',
      category: 'Smartphones',
      description: 'Fully tested and verified working.',
      gtin: '',
      has_variants: true,
      id: 'prod-iphone-13',
      image: '',
      imageHint: 'iPhone 13',
      imageLarge: '',
      manage_stock: false,
      mpn: '',
      name: 'iPhone 13',
      price: 437000,
      status: 'active',
      stock: 0,
      variants: [
        {
          id: 'variant-128gb',
          attributes: { storage: '128GB' },
          merchant_id: 'm-1',
          price_override: 437000,
          product_id: 'prod-iphone-13',
          stock_quantity: 5,
        },
      ],
    };

    render(
      <AddProductForm
        initialData={initialData}
        onCancel={vi.fn()}
        onProductAdded={onProductAdded}
      />
    );

    await user.click(screen.getByRole('tab', { name: 'Pricing' }));

    expect(await screen.findByText('Set unlimited stock')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Base price is unused when variants are enabled; pricing is controlled by variant overrides.'
      )
    ).toBeInTheDocument();
    expect(mockVariantBuilder).toHaveBeenCalledWith(
      expect.objectContaining({
        stockTrackingEnabled: false,
      })
    );

    await user.click(screen.getByRole('button', { name: 'Update Product' }));

    await waitFor(() =>
      expect(onProductAdded).toHaveBeenCalledWith(
        expect.objectContaining({
          has_variants: true,
          manage_stock: false,
          stock: 0,
          variants: [expect.objectContaining({ stock_quantity: 0 })],
        })
      )
    );
  });

  it('keeps the auto-generated slug in sync while typing a product name', async () => {
    const user = userEvent.setup();
    const onProductAdded = vi.fn();

    render(
      <AddProductForm onCancel={vi.fn()} onProductAdded={onProductAdded} />
    );

    await user.type(
      screen.getByRole('textbox', { name: /name/i }),
      'Jollof Pack'
    );
    await user.click(screen.getByRole('button', { name: 'Save Product' }));

    await waitFor(() =>
      expect(onProductAdded).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Jollof Pack',
          slug: 'jollof-pack',
        })
      )
    );
  });

  it('stops auto-syncing the slug once the user manually edits it', async () => {
    const user = userEvent.setup();
    const onProductAdded = vi.fn();

    render(
      <AddProductForm onCancel={vi.fn()} onProductAdded={onProductAdded} />
    );

    await user.type(
      screen.getByRole('textbox', { name: /name/i }),
      'Jollof Pack'
    );

    await user.click(screen.getByRole('tab', { name: /seo/i }));
    const slugInput = screen.getByRole('textbox', { name: /url slug/i });
    await user.clear(slugInput);
    await user.type(slugInput, 'my-custom-slug');

    await user.click(screen.getByRole('tab', { name: /general/i }));
    const nameInput = screen.getByRole('textbox', { name: /name/i });
    await user.clear(nameInput);
    await user.type(nameInput, 'Different Product');

    await user.click(screen.getByRole('button', { name: 'Save Product' }));

    await waitFor(() =>
      expect(onProductAdded).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Different Product',
          slug: 'my-custom-slug',
        })
      )
    );
  });

  it('ignores stale variants when the category does not support variants', async () => {
    mockGetCategoryConfigFromBusinessType.mockImplementation(() => ({
      description: 'General products',
      displayName: 'General',
      productCategories: ['General'],
      supportsVariants: false,
      variantAttributes: [],
    }));
    const user = userEvent.setup();
    const onProductAdded = vi.fn();
    const initialData: Product = {
      brand: 'Apple',
      category: 'General',
      description: 'Fully tested and verified working.',
      gtin: '',
      has_variants: true,
      id: 'prod-iphone-13',
      image: '',
      imageHint: 'iPhone 13',
      imageLarge: '',
      manage_stock: true,
      mpn: '',
      name: 'iPhone 13',
      price: 437000,
      status: 'active',
      stock: 7,
      variants: [
        {
          id: 'variant-stale',
          attributes: { storage: '128GB' },
          merchant_id: 'm-1',
          price_override: 437000,
          product_id: 'prod-iphone-13',
          stock_quantity: 99,
        },
      ],
    };

    render(
      <AddProductForm
        initialData={initialData}
        onCancel={vi.fn()}
        onProductAdded={onProductAdded}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Update Product' }));

    expect(mockVariantBuilder).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(onProductAdded).toHaveBeenCalledWith(
        expect.objectContaining({
          has_variants: false,
          price: 437000,
          stock: 7,
          variants: [],
        })
      )
    );
  });
});

import { describe, expect, it, vi } from 'vitest';

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
  VariantBuilder: () => 'VariantBuilder',
}));
vi.mock('@/components/ui/file-uploader', () => ({
  FileUploader: () => 'FileUploader',
}));
vi.mock('@/components/ui/rich-text-editor', () => ({
  RichTextEditor: () => 'RichTextEditor',
}));
vi.mock('@/hooks/use-merchant', () => ({
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
  getCategoryConfigFromBusinessType: vi.fn(() => ({
    categories: ['General'],
    label: 'Category',
  })),
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

describe('AddProductForm', () => {
  it('exports a valid component', () => {
    expect(AddProductForm).toBeDefined();
    expect(typeof AddProductForm).toBe('function');
  });
});

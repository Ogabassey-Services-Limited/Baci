import { describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({
  default: () => 'img',
}));
vi.mock('next/link', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn() })),
}));
vi.mock('@/hooks/cart', () => ({
  useCart: vi.fn(() => ({
    items: [],
    addToCart: vi.fn(),
    totalItems: 0,
    removeFromCart: vi.fn(),
    updateQuantity: vi.fn(),
  })),
}));
vi.mock('../components/AdUnit', () => ({ AdUnit: () => 'AdUnit' }));
vi.mock('../components/BannerCarousel', () => ({ BannerCarousel: () => 'BannerCarousel' }));
vi.mock('../components/BlogSnippet', () => ({ BlogSnippet: () => 'BlogSnippet' }));
vi.mock('../contexts/ComparisonContext', () => ({
  useComparison: vi.fn(() => ({
    comparisonIds: new Set(),
    toggleComparison: vi.fn(),
  })),
}));
vi.mock('../contexts/SavedContext', () => ({
  useSaved: vi.fn(() => ({
    savedItems: [],
    toggleSaved: vi.fn(),
    isSaved: vi.fn(() => false),
    toastState: { show: false, message: '', type: 'add' },
    dismissToast: vi.fn(),
  })),
}));
vi.mock('../data/products', () => ({
  products: [],
}));

import { OgabasseyV2ProductDetails } from './product-details';

describe('OgabasseyV2ProductDetails', () => {
  it('exports a valid component', () => {
    expect(OgabasseyV2ProductDetails).toBeDefined();
    expect(typeof OgabasseyV2ProductDetails).toBe('function');
  });
});

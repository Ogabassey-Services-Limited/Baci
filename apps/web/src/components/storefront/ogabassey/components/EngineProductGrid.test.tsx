import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/test-store'),
}));
vi.mock('@/hooks/use-cart', () => ({
  useCart: vi.fn(() => ({ items: [], addToCart: vi.fn(), totalItems: 0 })),
}));
vi.mock('@/hooks/use-merchant', () => ({
  useMerchantSafe: vi.fn(() => ({ merchant: { id: 'm-1', slug: 'test' } })),
}));
vi.mock('../data/products', () => ({ products: [] }));
vi.mock('../providers/v2-saved-context', () => ({
  useV2Saved: vi.fn(() => ({ savedIds: new Set(), toggleSaved: vi.fn() })),
}));
vi.mock('./AdUnit', () => ({ AdUnit: () => null }));
vi.mock('./AdvancedProductFilters', () => ({
  AdvancedProductFilters: () => null,
}));
vi.mock('./FloatingParticles', () => ({
  FloatingParticles: () => null,
}));
vi.mock('./ProductGridItem', () => ({
  ProductGridItem: () => <div data-testid="grid-item" />,
}));
vi.mock('./ProductListItem', () => ({
  ProductListItem: () => <div data-testid="list-item" />,
}));

import { EngineProductGrid } from './EngineProductGrid';

describe('EngineProductGrid', () => {
  it('renders without crashing with empty products', () => {
    const { container } = render(
      <EngineProductGrid externalProducts={[]} categories={[]} />
    );
    expect(container).toBeDefined();
  });
});

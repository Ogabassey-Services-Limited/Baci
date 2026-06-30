import { render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCachedCategories,
  getRequestScopedMerchant,
} from '@/lib/cached-data';

type CategoryPageProps = {
  params: Promise<{ category: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const { mockCategoryPageRoute, mockComparePageContent } = vi.hoisted(() => ({
  mockCategoryPageRoute: vi.fn((_props: CategoryPageProps) => (
    <div>Compare category content</div>
  )),
  mockComparePageContent: vi.fn((_props: unknown) => (
    <div>Compare index content</div>
  )),
}));

const mockConnection = vi.hoisted(() => vi.fn());
const mockNotFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});

vi.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
}));

vi.mock('next/server', () => ({
  connection: () => mockConnection(),
}));

vi.mock('@/lib/cached-data', () => ({
  getCachedCategories: vi.fn(),
  getCachedCategoryPageData: vi.fn(),
  getRequestScopedMerchant: vi.fn(),
}));

vi.mock('../[category]/page', () => ({
  default: (props: CategoryPageProps) => mockCategoryPageRoute(props),
  generateMetadata: vi.fn(),
}));

vi.mock('./compare-page-content', () => ({
  ComparePageContent: (props: unknown) => mockComparePageContent(props),
}));

type RequestScopedMerchant = NonNullable<
  Awaited<ReturnType<typeof getRequestScopedMerchant>>
>;
type CachedCategories = Awaited<ReturnType<typeof getCachedCategories>>;

const merchant = {
  id: 'merchant-1',
  business_name: 'Ogabassey',
  site_title: 'Ogabassey',
  site_tagline: 'Devices and repairs',
  site_description: 'Shop devices and repairs.',
  business_type: 'electronics',
  logo_url: '',
  phone: '',
  email: 'support@ogabassey.com',
  slug: 'ogabassey',
  custom_domain: 'ogabassey.com',
  business_address: '',
  payout_currency: 'NGN',
  is_published: true,
  template_id: 'ogabassey',
  plan_tier: 'free',
  premium_features: {},
  country: 'NG',
} satisfies RequestScopedMerchant;

const categories = [
  {
    id: 'category-1',
    name: 'Laptops',
    slug: 'laptops',
    description: null,
    image_url: null,
    is_active: true,
    parent_id: null,
  },
] satisfies CachedCategories;

const { default: CompareIndexPage } = await import('./page');

describe('compare index page runtime', () => {
  beforeEach(() => {
    vi.mocked(getRequestScopedMerchant).mockReset();
    vi.mocked(getCachedCategories).mockReset();
    vi.mocked(getRequestScopedMerchant).mockResolvedValue(merchant);
    vi.mocked(getCachedCategories).mockResolvedValue(categories);
    mockComparePageContent.mockReset();
    mockComparePageContent.mockImplementation(() => (
      <div>Compare index content</div>
    ));
    mockCategoryPageRoute.mockReset();
    mockCategoryPageRoute.mockImplementation(() => (
      <div>Compare category content</div>
    ));
    mockConnection.mockReset();
    mockNotFound.mockClear();
  });

  it('defers compare index first paint to the route loader while content is pending', () => {
    mockComparePageContent.mockImplementation(() => {
      throw new Promise(() => {
        // Keep content suspended behind the catalog loader.
      });
    });

    render(
      <Suspense fallback={<div>Route loader fallback</div>}>
        <CompareIndexPage params={Promise.resolve({ slug: 'ogabassey' })} />
      </Suspense>
    );

    expect(
      screen.getByRole('status', { name: 'Loading product listing' })
    ).toBeInTheDocument();
    expect(screen.queryByText('Compare index content')).not.toBeInTheDocument();
  });
});

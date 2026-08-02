import type { PuckContext } from '@puckeditor/core';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { expect, it, vi } from 'vitest';
import { buildCuratedStorefront } from '@/lib/storefront-defaults/build-curated-storefront';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchantSafe: () => ({ basePath: '' }),
}));
vi.mock('@/hooks/use-cart', () => ({
  useCart: () => ({
    cart: [],
    addToCart: vi.fn(),
    updateQuantity: vi.fn(),
    setMerchantSlug: vi.fn(),
  }),
}));
vi.mock('@/hooks/use-currency', () => ({
  useCurrency: () => ({
    formatCurrencyCompact: (value: number) => `$${value}`,
  }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/contexts/storefront-context', () => ({
  useStorefrontSafe: () => null,
}));
vi.mock('@/components/storefront/product-card', () => ({
  StorefrontProductCard: () => <div />,
}));
vi.mock('@/components/storefront/quick-view-modal', () => ({
  QuickViewModal: () => null,
  useQuickView: () => ({
    product: null,
    isOpen: false,
    openQuickView: vi.fn(),
    closeQuickView: vi.fn(),
  }),
}));

const { builderConfig } = await import('./config');

type BuilderRenderProps<T> = T extends {
  render?: (props: infer Props) => ReactNode;
}
  ? Props
  : never;

const puck = {
  renderDropZone: () => null,
  metadata: {},
  isEditing: false,
  dragRef: null,
} satisfies PuckContext;

const starter = buildCuratedStorefront({
  businessName: 'North Star',
  businessType: 'fashion',
  country: 'Nigeria',
  brandColors: {
    primary: '#14532d',
    background: '#fff7ed',
    accent: '#f97316',
  },
});

function starterHierarchyBlocks(content: typeof starter.content) {
  return content.filter((block) =>
    ['ProductGrid', 'Newsletter', 'Footer'].includes(block.type)
  );
}

it('renders configured ProductGrid, Newsletter, and Footer blocks in generated order', () => {
  const [productGrid, newsletter, footer] = starterHierarchyBlocks(
    starter.content
  );
  if (
    productGrid?.type !== 'ProductGrid' ||
    newsletter?.type !== 'Newsletter' ||
    footer?.type !== 'Footer'
  )
    throw new Error('Generated starter hierarchy blocks must be configured');
  const productGridProps = {
    ...productGrid.props,
    puck,
  } satisfies BuilderRenderProps<typeof builderConfig.components.ProductGrid>;
  const newsletterProps = {
    ...newsletter.props,
    puck,
  } satisfies BuilderRenderProps<typeof builderConfig.components.Newsletter>;
  const footerProps = {
    ...footer.props,
    puck,
  } satisfies BuilderRenderProps<typeof builderConfig.components.Footer>;
  const renderProductGrid = builderConfig.components.ProductGrid.render;
  const renderNewsletter = builderConfig.components.Newsletter.render;
  const renderFooter = builderConfig.components.Footer.render;

  render(
    <>
      {renderProductGrid(productGridProps)}
      {renderNewsletter(newsletterProps)}
      {renderFooter(footerProps)}
    </>
  );

  expect(
    screen.getByRole('heading', { level: 2, name: 'Explore products' })
  ).toBeInTheDocument();
  expect(
    screen.getByRole('heading', { level: 2, name: 'Updates from North Star' })
  ).toBeInTheDocument();
  expect(
    screen.getByRole('heading', { level: 3, name: 'Your Store' })
  ).toBeInTheDocument();
  expect(
    screen.getByRole('heading', { level: 3, name: 'Quick Links' })
  ).toBeInTheDocument();
});

it('does not invent missing or empty configured hierarchy blocks', () => {
  expect(starterHierarchyBlocks([])).toEqual([]);
  expect(
    starterHierarchyBlocks(
      starter.content.filter((block) => block.type !== 'Newsletter')
    ).map((block) => block.type)
  ).toEqual(['ProductGrid', 'Footer']);
});

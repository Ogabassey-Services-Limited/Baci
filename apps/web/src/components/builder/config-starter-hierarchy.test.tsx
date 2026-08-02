import type { PuckContext } from '@puckeditor/core';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { expect, it, vi } from 'vitest';
import { getContrastRatio } from '@/lib/color-utils';
import { buildCuratedStorefront } from '@/lib/storefront-defaults/build-curated-storefront';
import { deriveCuratedTheme } from '@/lib/storefront-defaults/derive-curated-theme';

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
vi.mock('./animated-wrapper', () => ({
  AnimatedWrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
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
    ['ProductGrid', 'Features', 'Newsletter', 'Footer'].includes(block.type)
  );
}

it('renders configured Builder surfaces with their derived foreground tokens', () => {
  const [productGrid, features, newsletter, footer] = starterHierarchyBlocks(
    starter.content
  );
  if (
    productGrid?.type !== 'ProductGrid' ||
    features?.type !== 'Features' ||
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
  const featureProps = {
    ...features.props,
    puck,
  } satisfies BuilderRenderProps<typeof builderConfig.components.Features>;
  const footerProps = {
    ...footer.props,
    puck,
  } satisfies BuilderRenderProps<typeof builderConfig.components.Footer>;
  const renderProductGrid = builderConfig.components.ProductGrid.render;
  const renderFeatures = builderConfig.components.Features.render;
  const renderNewsletter = builderConfig.components.Newsletter.render;
  const renderFooter = builderConfig.components.Footer.render;

  render(
    <>
      {renderProductGrid(productGridProps)}
      {renderFeatures(featureProps)}
      {renderNewsletter(newsletterProps)}
      {renderFooter(footerProps)}
    </>
  );

  expect(
    screen.getByRole('heading', { level: 2, name: 'Explore products' })
  ).toHaveClass('text-foreground');
  expect(
    screen.getByRole('heading', { level: 2, name: 'Updates from North Star' })
  ).toBeInTheDocument();
  expect(
    screen
      .getByRole('heading', { level: 3, name: 'Browse' })
      .closest('.text-foreground')
  ).not.toBeNull();
  expect(
    screen.getByRole('heading', { level: 3, name: 'North Star' })
  ).toBeInTheDocument();
  expect(
    screen.getByRole('heading', { level: 3, name: 'Quick Links' })
  ).toBeInTheDocument();
  expect(
    screen.getByText('© North Star. All rights reserved.')
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('heading', { level: 3, name: 'Follow Us' })
  ).not.toBeInTheDocument();
  expect(screen.getByText('Receive updates from North Star.')).not.toHaveClass(
    'opacity-90'
  );
  expect(
    screen.getByText('© North Star. All rights reserved.')
  ).not.toHaveClass('opacity-80');
  expect(screen.getByRole('link', { name: 'About Us' })).not.toHaveClass(
    'opacity-80'
  );
});

it.each([
  { primary: '#000000', background: '#ffffff', accent: '#777777' },
  { primary: '#777777', background: '#000000', accent: '#ffffff' },
  { primary: '#ffffff', background: '#000000', accent: '#000000' },
])('keeps Builder text surfaces AA-safe for derived preview colors', (brandColors) => {
  const theme = deriveCuratedTheme(brandColors, 'fashion');
  expect(
    getContrastRatio(theme.colors.foreground, theme.colors.background)
  ).toBeGreaterThanOrEqual(4.5);
  expect(
    getContrastRatio(theme.colors.button.primary.text, theme.colors.primary)
  ).toBeGreaterThanOrEqual(4.5);
  expect(
    getContrastRatio(theme.colors.footer.text, theme.colors.footer.background)
  ).toBeGreaterThanOrEqual(4.5);
});

it('does not invent missing or empty configured hierarchy blocks', () => {
  expect(starterHierarchyBlocks([])).toEqual([]);
  expect(
    starterHierarchyBlocks(
      starter.content.filter((block) => block.type !== 'Newsletter')
    ).map((block) => block.type)
  ).toEqual(['ProductGrid', 'Features', 'Footer']);
});

import { render, screen } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseMerchantSafe = vi.hoisted(() => vi.fn());

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('next/image', () => ({
  default: ({ alt, src }: { alt: string; src: string }) =>
    createElement('img', { alt, src }),
}));

vi.mock('@/hooks/use-merchant', () => ({
  useMerchant: () => mockUseMerchantSafe(),
  useMerchantSafe: () => mockUseMerchantSafe(),
}));

const { builderConfig } = await import('./config');

type FooterRenderProps = {
  copyrightText?: string;
  showQuickLinks: boolean;
  quickLinks: { label: string; url: string }[];
  socialLinks: Record<string, string | undefined>;
  showNewsletter?: boolean;
  backgroundColor?: string;
  textColor?: string;
};

function renderFooter(props: Partial<FooterRenderProps> = {}) {
  const renderFooterComponent = builderConfig.components.Footer.render as (
    props: FooterRenderProps
  ) => ReactNode;

  return render(
    renderFooterComponent({
      showQuickLinks: true,
      quickLinks: [],
      socialLinks: {},
      showNewsletter: false,
      ...props,
    })
  );
}

describe('builderConfig Footer', () => {
  beforeEach(() => {
    mockUseMerchantSafe.mockReturnValue({ basePath: '/style-store' });
  });

  it('scopes internal quick links to the current merchant storefront', () => {
    renderFooter({
      quickLinks: [
        { label: 'About Us', url: '/about' },
        { label: 'Contact', url: '/contact' },
        { label: 'External', url: 'https://example.com' },
        { label: 'Products', url: '#products' },
      ],
    });

    expect(screen.getByRole('link', { name: 'About Us' })).toHaveAttribute(
      'href',
      '/style-store/about'
    );
    expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute(
      'href',
      '/style-store/contact'
    );
    expect(screen.getByRole('link', { name: 'External' })).toHaveAttribute(
      'href',
      'https://example.com'
    );
    expect(screen.getByRole('link', { name: 'Products' })).toHaveAttribute(
      'href',
      '#products'
    );
  });

  it('leaves internal links unchanged when merchant context is unavailable', () => {
    // Hydration-gap scenario: no merchant context, no basePath -> the
    // `!basePath` branch in getStorefrontScopedHref must keep links bare.
    mockUseMerchantSafe.mockReturnValue(undefined);
    renderFooter({
      quickLinks: [
        { label: 'About Us', url: '/about' },
        { label: 'External', url: 'https://example.com' },
      ],
    });

    expect(screen.getByRole('link', { name: 'About Us' })).toHaveAttribute(
      'href',
      '/about'
    );
    expect(screen.getByRole('link', { name: 'External' })).toHaveAttribute(
      'href',
      'https://example.com'
    );
  });

  it('does not override route metadata titles from the root render', () => {
    const previousTitle = document.title;
    document.title = 'Generated Storefront Metadata';
    const renderRoot = builderConfig.root?.render as (props: {
      children: ReactNode;
      title: string;
    }) => ReactNode;

    render(renderRoot({ title: 'Home', children: <main>Storefront</main> }));

    expect(document.title).toBe('Generated Storefront Metadata');
    document.title = previousTitle;
  });
});

describe('builderConfig scoped links', () => {
  beforeEach(() => {
    mockUseMerchantSafe.mockReturnValue({ basePath: '/style-store' });
  });

  it('scopes Hero CTA links to the current merchant storefront', () => {
    const renderHero = builderConfig.components.Hero.render as (
      props: Record<string, unknown>
    ) => ReactNode;

    render(
      renderHero({
        title: 'Welcome',
        subtitle: 'Shop products',
        ctaText: 'Shop Now',
        ctaLink: '/products',
        align: 'center',
        padding: 'small',
        overlay: false,
        headingLevel: 'h1',
        animationType: 'fade-in',
        animationDuration: 'normal',
        animationDelay: 0,
        animationTrigger: 'scroll',
      })
    );

    expect(screen.getByRole('link', { name: 'Shop Now' })).toHaveAttribute(
      'href',
      '/style-store/products'
    );
  });

  it('scopes Image links to the current merchant storefront', () => {
    const renderImage = builderConfig.components.Image.render as (
      props: Record<string, unknown>
    ) => ReactNode;

    render(
      renderImage({
        src: '/hero.jpg',
        alt: 'Featured product',
        link: '/category/decor',
        aspectRatio: '16/9',
        animationType: 'zoom-in',
        animationDuration: 'normal',
        animationDelay: 0,
        animationTrigger: 'scroll',
      })
    );

    expect(
      screen.getByRole('link', { name: /featured product/i })
    ).toHaveAttribute('href', '/style-store/category/decor');
  });

  it('scopes Button links to the current merchant storefront', () => {
    const renderButton = builderConfig.components.Button.render as (
      props: Record<string, unknown>
    ) => ReactNode;

    render(
      renderButton({
        text: 'Contact us',
        link: '/contact',
        variant: 'primary',
        align: 'center',
        size: 'default',
        puck: { dragRef: vi.fn() },
      })
    );

    expect(screen.getByRole('link', { name: 'Contact us' })).toHaveAttribute(
      'href',
      '/style-store/contact'
    );
  });
});

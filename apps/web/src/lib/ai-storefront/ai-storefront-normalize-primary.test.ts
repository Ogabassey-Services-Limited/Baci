import { describe, expect, it } from 'vitest';
import {
  normalizeFooter,
  normalizeHeader,
  normalizeHero,
  normalizeProductGrid,
} from './ai-storefront-normalize-primary';

describe('ai storefront primary section normalizers', () => {
  it('normalizes header aliases, links, CTA, booleans, and literals', () => {
    const header = normalizeHeader(
      {
        id: 'main-header',
        show_logo: false,
        show_search: false,
        show_cart: true,
        show_menu: true,
        navigation: [{ name: 'Catalog', href: '/products' }],
        cta_button: { label: 'Deals', href: '/deals' },
        layout: 'logo-center',
        search_style: 'filled',
        search_radius: 'full',
        padding_y: 'lg',
        glass_effect: true,
      },
      0
    );

    expect(header).toEqual(
      expect.objectContaining({
        type: 'Header',
        props: expect.objectContaining({
          id: 'main-header',
          showLogo: false,
          showSearch: false,
          navigationLinks: [{ label: 'Catalog', url: '/products' }],
          ctaButton: { show: true, text: 'Deals', url: '/deals' },
          layout: 'logo-center',
          searchStyle: 'filled',
          searchRadius: 'full',
          paddingY: 'lg',
          glassEffect: true,
        }),
      })
    );
  });

  it('normalizes hero aliases, CTA precedence, href safety, and fallbacks', () => {
    const hero = normalizeHero(
      'Bassey Phones',
      {
        headline: 'Premium phones',
        body: 'Curated phones and accessories',
        cta_button: { text: 'Buy now', link: '/products' },
        background_image: 'http://not-safe.test/image.jpg',
        align: 'left',
        padding: 'large',
        heading_level: 'h2',
      },
      1
    );

    if (hero.type !== 'Hero') throw new Error('Expected Hero component');
    expect(hero.props).toEqual(
      expect.objectContaining({
        id: 'hero-2',
        title: 'Premium phones',
        subtitle: 'Curated phones and accessories',
        ctaText: 'Buy now',
        ctaLink: '/products',
        align: 'left',
        padding: 'large',
        headingLevel: 'h2',
      })
    );
    expect(hero.props.backgroundImage).toBeUndefined();
  });

  it('clamps product grid numbers and falls back for invalid literals', () => {
    const productGrid = normalizeProductGrid(
      {
        title: 'Latest drops',
        columns: 99,
        limit: 1,
        sort_by: 'unknown',
        show_filters: false,
      },
      2
    );

    expect(productGrid.props).toEqual(
      expect.objectContaining({
        id: 'product-grid-3',
        title: 'Latest drops',
        columns: 4,
        limit: 4,
        sortBy: 'newest',
        showFilters: false,
      })
    );
  });

  it('normalizes footer links, social hrefs, and invalid social fallbacks', () => {
    const footer = normalizeFooter(
      'Bassey Phones',
      {
        links: [{ title: 'Contact', link: '/contact' }],
        social_links: {
          instagram: 'https://instagram.com/bassey',
          twitter: 'http://twitter.com/not-safe',
        },
        show_newsletter: true,
      },
      3
    );

    expect(footer.props).toEqual(
      expect.objectContaining({
        id: 'footer-4',
        showQuickLinks: true,
        quickLinks: [{ label: 'Contact', url: '/contact' }],
        socialLinks: { instagram: 'https://instagram.com/bassey' },
        showNewsletter: true,
      })
    );
  });
});

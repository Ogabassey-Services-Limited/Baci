import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import type { MerchantBlogOgImageData } from '@/app/(storefront)/[slug]/(blog)/blog/[postSlug]/opengraph-image-data';
import {
  renderGenericFallback,
  renderMerchantFallback,
  renderPrimaryCard,
} from '@/app/(storefront)/[slug]/(blog)/blog/[postSlug]/opengraph-image-markup';

function createData(
  overrides: Partial<MerchantBlogOgImageData> = {}
): MerchantBlogOgImageData {
  return {
    merchantBusinessName: 'Ogabassey',
    merchantBrandColors: {
      background: '#101820',
      primary: '#0af',
      accent: '#fc0',
    },
    post: {
      title: 'Best iPhone Deals',
      category: 'Smartphones',
      featured_image_url:
        'https://cdn.ogabassey.com/media/merchant-1/blog/raw.jpg',
      featured_image_alt: 'iPhone on desk',
      author_name: 'Baci Editorial',
      featured_image_width: 1200,
      featured_image_height: 675,
      featured_image_variants: {},
    },
    featuredDataUri: 'data:image/jpeg;base64,ZmVhdHVyZWQ=',
    featuredImageStatus: 'loaded',
    logoDataUri: 'data:image/png;base64,bG9nbw==',
    ...overrides,
  };
}

function collectText(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return '';
  }
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(collectText).join(' ');
  if (typeof node === 'object' && 'props' in node) {
    return collectText(
      (node as { props: { children?: unknown } }).props.children
    );
  }
  return '';
}

function collectImageSources(node: unknown): string[] {
  if (node === null || node === undefined || typeof node !== 'object') {
    return [];
  }
  if (Array.isArray(node)) return node.flatMap(collectImageSources);
  if (!('type' in node) || !('props' in node)) return [];

  const element = node as {
    type: unknown;
    props: { children?: unknown; src?: unknown };
  };
  const ownSource =
    element.type === 'img' && typeof element.props.src === 'string'
      ? [element.props.src]
      : [];
  return [...ownSource, ...collectImageSources(element.props.children)];
}

describe('merchant blog OG image markup', () => {
  it('renders the primary card with brand, post, logo, and featured image', () => {
    const element = renderPrimaryCard(createData());

    expect(collectText(element)).toContain('Best iPhone Deals');
    expect(collectText(element)).toContain('Smartphones');
    expect(collectText(element)).toContain('Ogabassey');
    expect(collectImageSources(element)).toContain(
      'data:image/jpeg;base64,ZmVhdHVyZWQ='
    );
  });

  it('renders branded fallback art with safe color transparency', () => {
    const element = renderMerchantFallback(createData(), 'Missing post');
    const children: unknown[] = Array.isArray(element.props.children)
      ? element.props.children
      : [element.props.children];
    const overlay = children.filter(Boolean).find((child) => {
      const elementChild = child as ReactElement<{
        style?: Record<string, unknown>;
      }>;
      return elementChild.props?.style?.position === 'absolute';
    }) as ReactElement<{ style?: Record<string, unknown> }> | undefined;

    expect(collectText(element)).toContain('Missing post');
    expect(overlay?.props.style?.background).toContain(
      'rgba(0, 170, 255, 0.2)'
    );
  });

  it('renders a generic fallback without merchant data', () => {
    expect(collectText(renderGenericFallback('Post Not Found'))).toContain(
      'Post Not Found'
    );
  });
});

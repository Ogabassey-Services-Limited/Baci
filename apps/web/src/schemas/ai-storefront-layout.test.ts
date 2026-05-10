import { describe, expect, it } from 'vitest';
import {
  aiStorefrontComponentSchema,
  aiStorefrontLayoutSchema,
  aiStorefrontThemeSchema,
} from './ai-storefront-layout';

describe('aiStorefrontLayoutSchema', () => {
  it('accepts a minimal safe commerce layout', () => {
    const result = aiStorefrontLayoutSchema.safeParse({
      theme: {
        primary: '#111827',
        accent: '#f59e0b',
        background: '#ffffff',
      },
      sections: [
        {
          type: 'Header',
          props: { id: 'header', showLogo: true, showSearch: true },
        },
        {
          type: 'Hero',
          props: {
            id: 'hero',
            title: 'Premium phones delivered fast',
            subtitle:
              'Shop trusted devices, accessories, and repair essentials.',
            ctaText: 'Shop now',
          },
        },
        {
          type: 'ProductGrid',
          props: {
            id: 'products',
            title: 'Featured products',
            limit: 8,
          },
        },
        {
          type: 'Footer',
          props: {
            id: 'footer',
            showQuickLinks: true,
            quickLinks: [{ label: 'Contact', url: '/contact' }],
            showNewsletter: false,
          },
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('rejects unsafe CodeEmbed output', () => {
    const result = aiStorefrontComponentSchema.safeParse({
      type: 'CodeEmbed',
      props: { id: 'x', code: '<script>alert(1)</script>' },
    });

    expect(result.success).toBe(false);
  });

  it('rejects non-hex theme colors', () => {
    const result = aiStorefrontThemeSchema.safeParse({
      primary: 'javascript:alert(1)',
    });

    expect(result.success).toBe(false);
  });

  it('rejects unsafe links in generated navigation', () => {
    const result = aiStorefrontComponentSchema.safeParse({
      type: 'Header',
      props: {
        id: 'header',
        navigationLinks: [{ label: 'Bad', url: 'javascript:alert(1)' }],
      },
    });

    expect(result.success).toBe(false);
  });

  it('requires CTA text and URL when a header CTA is visible', () => {
    const result = aiStorefrontComponentSchema.safeParse({
      type: 'Header',
      props: {
        id: 'header',
        ctaButton: { show: true, text: 'Shop now' },
      },
    });

    expect(result.success).toBe(false);
  });

  it('requires quick links when the footer asks to show them', () => {
    const result = aiStorefrontComponentSchema.safeParse({
      type: 'Footer',
      props: { id: 'footer', showQuickLinks: true },
    });

    expect(result.success).toBe(false);
  });

  it('rejects non-HTTPS social links', () => {
    const result = aiStorefrontComponentSchema.safeParse({
      type: 'Footer',
      props: {
        id: 'footer',
        socialLinks: { instagram: 'http://instagram.com/baci' },
      },
    });

    expect(result.success).toBe(false);
  });
});

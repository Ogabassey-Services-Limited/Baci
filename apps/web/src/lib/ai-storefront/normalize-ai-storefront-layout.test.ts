import { describe, expect, it } from 'vitest';
import { normalizeAiStorefrontLayout } from '@/lib/ai-storefront/normalize-ai-storefront-layout';
import { aiStorefrontLayoutSchema } from '@/schemas/ai-storefront-layout';

describe('normalizeAiStorefrontLayout', () => {
  it('adds required commerce sections when the model omits them', () => {
    const config = normalizeAiStorefrontLayout({
      businessName: 'Bassey Phones',
      layout: aiStorefrontLayoutSchema.parse({
        sections: [
          {
            type: 'Hero',
            props: { id: 'hero', title: 'Phones for every budget' },
          },
          { type: 'Footer', props: { id: 'footer' } },
          {
            type: 'Newsletter',
            props: { id: 'newsletter', title: 'Get deals first' },
          },
          {
            type: 'Features',
            props: {
              id: 'features',
              features: [
                {
                  title: 'Fast delivery',
                  description: 'Same-week delivery in major cities.',
                },
                {
                  title: 'Trusted devices',
                  description: 'Carefully checked phones and accessories.',
                },
              ],
            },
          },
        ],
      }),
      starterConfig: { content: [], root: { title: 'Home' }, zones: {} },
    });

    expect(config.content.map((section) => section.type)).toContain('Header');
    expect(config.content.map((section) => section.type)).toContain(
      'ProductGrid'
    );
    expect(config.root.title).toBe('Home');
  });

  it('keeps only one Header and one Footer', () => {
    const config = normalizeAiStorefrontLayout({
      businessName: 'Bassey Phones',
      layout: aiStorefrontLayoutSchema.parse({
        sections: [
          { type: 'Header', props: { id: 'header-a' } },
          { type: 'Header', props: { id: 'header-b' } },
          { type: 'Hero', props: { id: 'hero', title: 'Premium phones' } },
          { type: 'ProductGrid', props: { id: 'products', limit: 8 } },
          { type: 'Footer', props: { id: 'footer-a' } },
          { type: 'Footer', props: { id: 'footer-b' } },
        ],
      }),
      starterConfig: { content: [], root: { title: 'Home' }, zones: {} },
    });

    expect(
      config.content.filter((section) => section.type === 'Header')
    ).toHaveLength(1);
    expect(
      config.content.filter((section) => section.type === 'Footer')
    ).toHaveLength(1);
  });

  it('preserves accepted theme values on the normalized builder config', () => {
    const config = normalizeAiStorefrontLayout({
      businessName: 'Bassey Phones',
      layout: aiStorefrontLayoutSchema.parse({
        theme: { primary: '#111827', accent: '#f59e0b' },
        sections: [
          { type: 'Header', props: { id: 'header' } },
          { type: 'Hero', props: { id: 'hero', title: 'Premium phones' } },
          { type: 'ProductGrid', props: { id: 'products', limit: 8 } },
          { type: 'Footer', props: { id: 'footer' } },
        ],
      }),
      starterConfig: {
        content: [],
        root: { title: 'Home' },
        zones: {},
        theme: {
          typography: { headingFont: 'Fraunces' },
          colors: { secondary: '#0f766e' },
        },
      },
    });

    expect(config).toEqual(
      expect.objectContaining({
        theme: {
          typography: { headingFont: 'Fraunces' },
          colors: {
            primary: '#111827',
            accent: '#f59e0b',
            secondary: '#0f766e',
          },
        },
      })
    );
  });

  it('preserves starter colors when the AI theme is partial', () => {
    const config = normalizeAiStorefrontLayout({
      businessName: 'Bassey Phones',
      layout: aiStorefrontLayoutSchema.parse({
        theme: { primary: '#111827' },
        sections: [
          { type: 'Header', props: { id: 'header' } },
          { type: 'Hero', props: { id: 'hero', title: 'Premium phones' } },
          { type: 'ProductGrid', props: { id: 'products', limit: 8 } },
          { type: 'Footer', props: { id: 'footer' } },
        ],
      }),
      starterConfig: {
        content: [],
        root: { title: 'Home' },
        zones: {},
        theme: {
          colors: {
            accent: '#0ea5e9',
            background: '#ffffff',
          },
        },
      },
    });

    expect(config.theme).toEqual(
      expect.objectContaining({
        colors: {
          primary: '#111827',
          accent: '#0ea5e9',
          background: '#ffffff',
        },
      })
    );
  });

  it('preserves starter theme when the AI provides no theme', () => {
    const starterTheme = {
      typography: { headingFont: 'Fraunces' },
      colors: {
        primary: '#0f172a',
        accent: '#0ea5e9',
        background: '#ffffff',
      },
    };

    const config = normalizeAiStorefrontLayout({
      businessName: 'Bassey Phones',
      layout: aiStorefrontLayoutSchema.parse({
        sections: [
          { type: 'Header', props: { id: 'header' } },
          { type: 'Hero', props: { id: 'hero', title: 'Premium phones' } },
          { type: 'ProductGrid', props: { id: 'products', limit: 8 } },
          { type: 'Footer', props: { id: 'footer' } },
        ],
      }),
      starterConfig: {
        content: [],
        root: { title: 'Home' },
        zones: {},
        theme: starterTheme,
      },
    });

    expect(config.theme).toEqual(starterTheme);
  });
});

import { describe, expect, it } from 'vitest';
import {
  getAiStorefrontDesignRationale,
  normalizeAiStorefrontLayout,
} from '@/lib/ai-storefront/normalize-ai-storefront-layout';
import {
  aiStorefrontComponentSchema,
  aiStorefrontLayoutSchema,
} from '@/schemas/ai-storefront-layout';
import { builderConfigSchema } from '@/schemas/builder';

describe('normalizeAiStorefrontLayout', () => {
  it('reads and trims the AI design rationale', () => {
    expect(
      getAiStorefrontDesignRationale({
        designRationale: '  Clean retail structure  ',
      })
    ).toBe('Clean retail structure');
  });

  it('truncates long AI design rationales', () => {
    expect(
      getAiStorefrontDesignRationale({ designRationale: 'a'.repeat(510) })
    ).toHaveLength(500);
  });

  it('returns null for missing or invalid AI design rationales', () => {
    expect(getAiStorefrontDesignRationale({})).toBeNull();
    expect(getAiStorefrontDesignRationale({ designRationale: 123 })).toBeNull();
    expect(getAiStorefrontDesignRationale(undefined)).toBeNull();
  });

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

  it('coerces Gemma-shaped section props into strict renderer-safe props', () => {
    const config = normalizeAiStorefrontLayout({
      businessName: 'Codex Gadgets',
      layout: {
        theme: {
          primary: '#047857',
          accent: '#2563eb',
          background: 'white',
        },
        sections: [
          {
            type: 'Header',
            props: {
              logo: 'Codex Gadgets',
              navigation: [
                { label: 'Home', url: '/' },
                { label: 'Shop', url: '/products' },
              ],
              cta_button: { text: 'Shop now', url: '/products' },
            },
          },
          {
            type: 'Hero',
            props: {
              title: 'Blue and green tech essentials',
              subtitle: 'Reliable electronics picked for everyday work.',
              cta_button: { text: 'Browse products', url: '/products' },
              background_color: '#f0fdfa',
            },
          },
          {
            type: 'ProductGrid',
            props: {
              title: 'Featured products',
              products: [],
            },
          },
          {
            type: 'TrustBadges',
            props: {
              badges: [
                'Fast Lagos delivery',
                'Secure checkout',
                'Warranty support',
              ],
            },
          },
          {
            type: 'Newsletter',
            props: {
              title: 'Get restock alerts',
              input_field: 'Email address',
              cta_button: 'Subscribe',
            },
          },
          {
            type: 'Footer',
            props: {
              business_name: 'Codex Gadgets',
              links: [{ label: 'Contact', url: '/contact' }],
              copyright: '(c) 2026 Codex Gadgets',
            },
          },
        ],
      } as never,
      starterConfig: {
        content: [],
        root: { title: 'Home' },
        zones: {},
        theme: { colors: { background: '#ffffff' } },
      },
    });

    expect(builderConfigSchema.safeParse(config).success).toBe(true);
    expect(
      config.content.map((section) =>
        aiStorefrontComponentSchema.safeParse(section)
      )
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ success: true }),
        expect.objectContaining({ success: true }),
      ])
    );
    expect(
      config.content.every(
        (section) => aiStorefrontComponentSchema.safeParse(section).success
      )
    ).toBe(true);
    expect(config.theme).toEqual(
      expect.objectContaining({
        colors: {
          primary: '#047857',
          accent: '#2563eb',
          background: '#ffffff',
        },
      })
    );
    expect(
      config.content.find((section) => section.type === 'Header')?.props
    ).not.toHaveProperty('logo');
    expect(
      config.content.find((section) => section.type === 'TrustBadges')?.props
    ).toEqual(
      expect.objectContaining({
        badges: expect.arrayContaining([
          expect.objectContaining({
            title: 'Fast Lagos delivery',
            icon: 'check',
          }),
        ]),
      })
    );
  });
});

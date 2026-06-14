/**
 * AI-friendly schema definition for the visual builder components.
 * This file maps the complex Puck config into a simplified format that
 * LLMs can easily understand and generate.
 */

export const COMPONENT_SCHEMA = {
  Header: {
    description: 'Site navigation and logo area. Always present at the top.',
    props: {
      showSearch: { type: 'boolean', description: 'Show search bar' },
      layout: {
        type: 'string',
        enum: ['logo-left-nav-center', 'logo-left-nav-right', 'logo-center'],
        description: 'Visual layout arrangement',
      },
      glassEffect: {
        type: 'boolean',
        description: 'Enable frosted glass background',
      },
    },
  },
  Hero: {
    description:
      'Large banner section with text and call-to-action. usually the first item below header.',
    props: {
      title: { type: 'string', description: 'Main headline (H1)' },
      subtitle: { type: 'string', description: 'Supporting text' },
      ctaText: { type: 'string', description: 'Button label' },
      align: { type: 'string', enum: ['left', 'center', 'right'] },
      padding: { type: 'string', enum: ['small', 'medium', 'large'] },
      backgroundImage: {
        type: 'string',
        description: 'URL of background image',
      },
      overlay: {
        type: 'boolean',
        description: 'Dark overlay for text readability',
      },
    },
  },
  HeroCarousel: {
    description: 'Rotating slider of multiple Hero banners.',
    props: {
      slides: {
        type: 'array',
        items: {
          title: { type: 'string' },
          subtitle: { type: 'string' },
          image: { type: 'string', description: 'Image URL' },
          ctaText: { type: 'string' },
        },
      },
    },
  },
  Features: {
    description:
      'Grid of 2-4 key selling points or benefits (e.g., Fast Shipping, 24/7 Support).',
    props: {
      title: { type: 'string', description: 'Section heading' },
      columns: { type: 'number', enum: [2, 3, 4] },
      features: {
        type: 'array',
        items: {
          title: { type: 'string' },
          description: { type: 'string' },
          icon: {
            type: 'string',
            description: 'Lucide icon name (e.g., truck, shield, star)',
          },
        },
      },
    },
  },
  ProductGrid: {
    description: 'Grid displaying products from the catalog.',
    props: {
      title: {
        type: 'string',
        description: 'Section heading (e.g., New Arrivals)',
      },
      columns: { type: 'number', enum: [2, 3, 4] },
      limit: { type: 'number', description: 'Number of products to show' },
      sortBy: { type: 'string', enum: ['newest', 'price-low', 'price-high'] },
    },
  },
  Testimonial: {
    description: 'Social proof section with quote and author.',
    props: {
      quote: { type: 'string' },
      author: { type: 'string' },
      role: { type: 'string' },
      rating: { type: 'number', min: 1, max: 5 },
    },
  },
  Text: {
    description: 'Generic rich text block for About Us or info sections.',
    props: {
      title: { type: 'string' },
      content: { type: 'string', description: 'Paragraph text' },
      align: { type: 'string', enum: ['left', 'center', 'right'] },
    },
  },
  Newsletter: {
    description: 'Email signup form.',
    props: {
      title: { type: 'string' },
      description: { type: 'string' },
      buttonText: { type: 'string' },
    },
  },
  Footer: {
    description: 'Site footer with links and copyright. Always at the bottom.',
    props: {
      showQuickLinks: { type: 'boolean' },
      showNewsletter: { type: 'boolean' },
    },
  },
};

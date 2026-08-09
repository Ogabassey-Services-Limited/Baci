import {
  allow,
  type BuilderDesignCapability,
  copy,
  deny,
  featureList,
  fixedPlacement,
  headerProps,
  heroProps,
  label,
  safeLink,
  safeTextProps,
} from './builder-design-capability-props';

export const builderDesignCapabilityDefinitions: BuilderDesignCapability[] = [
  deny(
    'OgabasseyHeader',
    'Merchant-specific header.',
    'merchant-specific',
    'This merchant-specific block is not available to AI.'
  ),
  deny(
    'OgabasseyHero',
    'Merchant-specific hero.',
    'merchant-specific',
    'This merchant-specific block is not available to AI.'
  ),
  deny(
    'OgabasseyNav',
    'Merchant-specific navigation.',
    'merchant-specific',
    'This merchant-specific block is not available to AI.'
  ),
  deny(
    'OgabasseyCategories',
    'Merchant-specific categories.',
    'merchant-specific',
    'This merchant-specific block is not available to AI.'
  ),
  deny(
    'OgabasseyUtilities',
    'Merchant-specific utilities.',
    'merchant-specific',
    'This merchant-specific block is not available to AI.'
  ),
  allow(
    'Header',
    'Store navigation.',
    headerProps,
    false,
    true,
    fixedPlacement
  ),
  allow('Hero', 'Prominent collection callout.', heroProps),
  allow(
    'HeroCarousel',
    'Rotating hero slides.',
    {
      slides: {
        item: {
          properties: {
            ctaLink: { ...safeLink, required: true },
            ctaText: { ...label(), required: true },
            image: { maximumLength: 512, required: true, type: 'safe-media' },
            subtitle: { ...copy(), required: true },
            title: { ...label(), required: true },
          },
          uniqueBy: 'title',
        },
        maximumItems: 5,
        minimumItems: 1,
        type: 'array',
      },
    },
    false,
    true,
    fixedPlacement
  ),
  allow('Text', 'Supporting storefront copy.', safeTextProps),
  deny(
    'Image',
    'Image asset block.',
    'media-review',
    'AI cannot select media until the asset pipeline is reviewed.'
  ),
  allow('Button', 'Call to action.', {
    align: { enum: ['left', 'center', 'right'], type: 'enum' },
    link: safeLink,
    size: { enum: ['sm', 'default', 'lg'], type: 'enum' },
    text: label(),
    variant: { enum: ['primary', 'background', 'accent'], type: 'enum' },
  }),
  allow('ProductGrid', 'Catalog product collection.', {
    columns: { maximum: 4, minimum: 2, type: 'number' },
    limit: { maximum: 24, minimum: 1, type: 'number' },
    showFilters: { type: 'boolean' },
    title: label('Featured products'),
  }),
  allow('Testimonial', 'Customer social proof.', {
    author: label('Name'),
    quote: copy('Add a customer quote.'),
    rating: { maximum: 5, minimum: 0, type: 'number' },
    role: label('Role'),
  }),
  allow('Features', 'Feature benefit list.', {
    columns: { maximum: 4, minimum: 2, type: 'number' },
    features: featureList,
    subtitle: copy(),
    title: label('Why choose us'),
  }),
  allow('Newsletter', 'Email signup invitation.', {
    buttonText: label('Subscribe'),
    description: copy('Sign up for updates from this store.'),
    placeholder: label('Enter your email'),
    title: label('Newsletter signup'),
  }),
  allow('Spacer', 'Vertical rhythm.', {
    height: { enum: ['small', 'medium', 'large', 'xlarge'], type: 'enum' },
  }),
  allow(
    'Footer',
    'Store footer.',
    {
      copyrightText: copy(),
      quickLinks: {
        item: {
          properties: {
            label: { ...label(), required: true },
            url: { ...safeLink, required: true },
          },
          uniqueBy: 'label',
        },
        maximumItems: 8,
        type: 'array',
      },
      showNewsletter: { type: 'boolean' },
      showQuickLinks: { type: 'boolean' },
    },
    false,
    true,
    fixedPlacement
  ),
  deny(
    'Video',
    'Embedded video.',
    'network-embed',
    'AI cannot add third-party embeds without a network and sandbox review.'
  ),
  deny(
    'Map',
    'Embedded map.',
    'network-embed',
    'AI cannot add third-party embeds without a network and sandbox review.'
  ),
  deny(
    'InstagramFeed',
    'External social feed.',
    'network-embed',
    'AI cannot add third-party feeds without a network and privacy review.'
  ),
  deny(
    'ContactForm',
    'Storefront form submission.',
    'data-collection',
    'AI cannot change data-collection forms without a submission-flow review.'
  ),
  deny(
    'SocialIcons',
    'External social links.',
    'external-navigation',
    'AI cannot create external navigation until link destinations are reviewed.'
  ),
  deny(
    'CodeEmbed',
    'Custom HTML or JavaScript.',
    'unsafe-code',
    'Custom code is not available to AI because it can bypass storefront safety controls.'
  ),
  deny(
    'Search',
    'Catalog search control.',
    'data-behavior',
    'AI cannot change catalog search behavior without a data-query review.'
  ),
  allow('FAQ', 'Frequently asked questions.', {
    items: {
      item: {
        properties: {
          answer: { ...copy(), required: true },
          question: { ...label(), required: true },
        },
        uniqueBy: 'question',
      },
      maximumItems: 12,
      minimumItems: 1,
      type: 'array',
    },
    style: { enum: ['accordion', 'grid', 'list'], type: 'enum' },
    subtitle: copy(),
    title: label(),
  }),
  deny(
    'AboutSection',
    'About section with media.',
    'media-review',
    'AI cannot select media until the asset pipeline is reviewed.'
  ),
  deny(
    'ContactSection',
    'Contact details, map, and form.',
    'data-collection',
    'AI cannot change contact collection or embeds without review.'
  ),
  allow('LegalSection', 'Store policy copy.', {
    lastUpdated: label(),
    sections: {
      item: {
        properties: {
          content: { ...copy(), required: true },
          heading: { ...label(), required: true },
        },
        uniqueBy: 'heading',
      },
      maximumItems: 12,
      minimumItems: 1,
      type: 'array',
    },
    title: label(),
  }),
  deny(
    'CountdownTimer',
    'Time-dependent promotion.',
    'renderer-state',
    'AI cannot add timers until date validation and expiry behavior are reviewed.'
  ),
  deny(
    'TrustBadges',
    'Trust badge icons.',
    'renderer-review',
    'AI cannot select badge icons until the renderer icon allowlist is reviewed.'
  ),
  deny(
    'AnnouncementBar',
    'Dismissible storefront notice.',
    'renderer-state',
    'AI cannot change dismissible notices until client-state behavior is reviewed.'
  ),
];

import type { Data } from '@puckeditor/core';
import { getInitialTemplateProfile } from '@/lib/initial-template-profiles';
import { buildCuratedFeatures } from './build-curated-features';
import { buildCuratedHero } from './build-curated-hero';
import type { CuratedStorefrontInput } from './curated-storefront-types';
import { deriveCuratedTheme } from './derive-curated-theme';

export function buildCuratedStorefront(input: CuratedStorefrontInput): Data {
  const profile = getInitialTemplateProfile(input.businessType);
  const hero = buildCuratedHero(input.businessName, input.businessType);
  const blocks: Data['content'] = [
    {
      type: 'Header',
      props: {
        id: 'Header-home',
        showLogo: true,
        showSearch: true,
        showCart: true,
        showMenu: true,
        sticky: true,
        navigationLinks: [
          { label: 'Home', url: '/' },
          { label: profile.shopNavLabel, url: '/products' },
          { label: 'About', url: '/about' },
        ],
        ctaButton: { show: false, text: 'Get Started', url: '/signup' },
        storeName: input.businessName,
        ...(input.logoUrl ? { logoUrl: input.logoUrl } : {}),
      },
    },
    { type: 'Hero', props: hero },
    {
      type: 'Text',
      props: {
        id: 'Text-story',
        title: profile.storyTitle,
        content: `Explore products from ${input.businessName}.`,
        align: profile.storyAlign,
        headingLevel: 'h2',
      },
    },
    {
      type: 'Features',
      props: {
        id: 'Features-trust',
        title: 'Explore the collection',
        features: buildCuratedFeatures(),
        columns: 3,
        headingLevel: 'h3',
      },
    },
    {
      type: 'ProductGrid',
      props: {
        id: 'ProductGrid-featured',
        title: profile.productGridTitle,
        columns: profile.productGridColumns,
        limit: profile.productGridLimit,
        sortBy: 'newest',
        showFilters: true,
        headingLevel: 'h3',
      },
    },
    {
      type: 'Newsletter',
      props: {
        id: 'Newsletter-home',
        title: 'Stay updated',
        description: `Get updates from ${input.businessName}.`,
        buttonText: 'Subscribe',
        placeholder: 'Enter your email',
        headingLevel: 'h3',
      },
    },
    {
      type: 'Footer',
      props: {
        id: 'Footer-home',
        showQuickLinks: true,
        quickLinks: [
          { label: 'About Us', url: '/about' },
          { label: 'Contact', url: '/contact' },
          { label: 'Privacy Policy', url: '/privacy' },
          { label: 'Terms', url: '/terms' },
        ],
        socialLinks: {},
        showNewsletter: false,
        headingLevel: 'h4',
      },
    },
  ];
  const config: Data = {
    content: [
      blocks[0],
      ...profile.contentOrder.map(
        (section) =>
          ({
            hero: blocks[1],
            story: blocks[2],
            features: blocks[3],
            products: blocks[4],
            newsletter: blocks[5],
          })[section]
      ),
      blocks[6],
    ],
    root: { props: { title: 'Home' } },
    zones: {},
  };
  (config as Record<string, unknown>).theme = deriveCuratedTheme(
    input.brandColors
  );
  return config;
}

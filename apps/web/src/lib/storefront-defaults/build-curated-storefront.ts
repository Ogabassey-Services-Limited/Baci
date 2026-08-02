import type { Data } from '@puckeditor/core';
import { getInitialTemplateProfile } from '@/lib/initial-template-profiles';
import { buildCuratedCopy } from './build-curated-copy';
import { buildCuratedFeatures } from './build-curated-features';
import { buildCuratedHero } from './build-curated-hero';
import type {
  CuratedStorefrontData,
  CuratedStorefrontInput,
} from './curated-storefront-types';
import { deriveCuratedTheme } from './derive-curated-theme';

export function buildCuratedStorefront(
  input: CuratedStorefrontInput
): CuratedStorefrontData {
  const profile = getInitialTemplateProfile(input.businessType);
  const copy = buildCuratedCopy(input);
  const hero = buildCuratedHero(input.businessType, copy.hero);
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
        navigationLinks: copy.header.navigationLinks,
        ctaButton: copy.header.ctaButton,
        storeName: input.businessName,
        ...(input.logoUrl ? { logoUrl: input.logoUrl } : {}),
      },
    },
    { type: 'Hero', props: hero },
    {
      type: 'Text',
      props: {
        id: 'Text-story',
        title: copy.story.title,
        content: copy.story.content,
        align: profile.storyAlign,
      },
    },
    {
      type: 'Features',
      props: {
        id: 'Features-trust',
        title: copy.features.title,
        features: buildCuratedFeatures(copy.features.items),
        columns: 3,
      },
    },
    {
      type: 'ProductGrid',
      props: {
        id: 'ProductGrid-featured',
        title: copy.products.title,
        columns: profile.productGridColumns,
        limit: profile.productGridLimit,
        sortBy: 'newest',
        showFilters: false,
      },
    },
    {
      type: 'Newsletter',
      props: {
        id: 'Newsletter-home',
        title: copy.newsletter.title,
        description: copy.newsletter.description,
        buttonText: copy.newsletter.buttonText,
        placeholder: copy.newsletter.placeholder,
      },
    },
    {
      type: 'Footer',
      props: {
        id: 'Footer-home',
        showQuickLinks: true,
        quickLinks: copy.footer.quickLinks,
        socialLinks: {},
        showNewsletter: false,
      },
    },
  ];
  return {
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
    theme: deriveCuratedTheme(input.brandColors, input.businessType),
  };
}

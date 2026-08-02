import type { Data } from '@puckeditor/core';
import {
  getInitialTemplateProfile,
  type TemplateSection,
} from '@/lib/initial-template-profiles';
import type { ThemeConfiguration } from '@/lib/theme-config';
import { generateFeatures } from './build-curated-features';
import { generateHeroSlides } from './build-curated-hero';
import type {
  AiContent,
  GenerateInitialTemplateParams,
  PuckBlock,
} from './curated-storefront-types';

export async function buildCuratedStorefront(
  params: GenerateInitialTemplateParams,
  theme: ThemeConfiguration,
  aiContent: AiContent | null
): Promise<Data> {
  const profile = getInitialTemplateProfile(params.businessType);
  const heroImageIds =
    (params.merchant?.hero_image_ids as string[]) || undefined;
  const slides = await generateHeroSlides(
    params.businessName,
    params.businessType,
    heroImageIds,
    aiContent?.hero
  );
  const features = generateFeatures(params.businessType, aiContent?.features);
  const now = Date.now();
  const headerBlock: PuckBlock = {
    type: 'Header',
    props: {
      id: `Header-${now}`,
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
      storeName: params.businessName,
      ...(typeof params.merchant?.logo_url === 'string'
        ? { logoUrl: params.merchant.logo_url }
        : {}),
    },
  };
  const sectionBlocks: Record<TemplateSection, PuckBlock> = {
    hero: {
      type: 'HeroCarousel',
      props: { id: `HeroCarousel-${now}-1`, slides, autoplayDelay: 5000 },
    },
    story: {
      type: 'Text',
      props: {
        id: `Text-${now}-2`,
        title: profile.storyTitle,
        content: profile.storyContent,
        align: profile.storyAlign,
      },
    },
    features: {
      type: 'Features',
      props: {
        id: `Features-${now}-3`,
        title: profile.featuresTitle,
        features,
        columns: 3,
      },
    },
    products: {
      type: 'ProductGrid',
      props: {
        id: `ProductGrid-${now}-4`,
        title: profile.productGridTitle,
        columns: profile.productGridColumns,
        limit: profile.productGridLimit,
        sortBy: 'newest',
        showFilters: true,
      },
    },
    newsletter: {
      type: 'Newsletter',
      props: {
        id: `Newsletter-${now}-5`,
        title: profile.newsletterTitle,
        description: profile.newsletterDescription,
        buttonText: 'Subscribe',
        placeholder: 'Enter your email',
      },
    },
  };
  const footerBlock: PuckBlock = {
    type: 'Footer',
    props: {
      id: `Footer-${now}-6`,
      showQuickLinks: true,
      quickLinks: [
        { label: 'About Us', url: '/about' },
        { label: 'Contact', url: '/contact' },
        { label: 'Privacy Policy', url: '/privacy' },
        { label: 'Terms', url: '/terms' },
      ],
      socialLinks: {},
      showNewsletter: false,
    },
  };
  const config: Data = {
    content: [
      headerBlock,
      ...profile.contentOrder.map((section) => sectionBlocks[section]),
      footerBlock,
    ],
    root: { props: { title: 'Home' } },
    zones: {},
  };
  (config as Record<string, unknown>).theme = theme;
  return config;
}

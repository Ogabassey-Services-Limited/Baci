import type { Data } from '@puckeditor/core';
import { getInitialTemplateProfile } from '@/lib/initial-template-profiles';
import { buildCuratedFeatures } from '@/lib/storefront-defaults/build-curated-features';
import { buildCuratedHero } from '@/lib/storefront-defaults/build-curated-hero';

// biome-ignore lint/suspicious/useAwait: preview call contract remains awaitable
export async function generatePreviewTemplate(params: {
  businessName: string;
  businessType: string;
  logoDataUri: string | null;
}): Promise<Data> {
  const profile = getInitialTemplateProfile(params.businessType);
  const hero = buildCuratedHero(params.businessName, params.businessType);
  const features = buildCuratedFeatures();
  const timestamp = Date.now();
  const header = {
    type: 'Header',
    props: {
      id: `Header-preview-${timestamp}`,
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
      ...(params.logoDataUri ? { logoUrl: params.logoDataUri } : {}),
    },
  } as Data['content'][number];
  const sections = {
    hero: {
      type: 'Hero',
      props: hero,
    },
    story: {
      type: 'Text',
      props: {
        id: `Text-preview-${timestamp}`,
        title: profile.storyTitle,
        content: profile.storyContent,
        align: profile.storyAlign,
      },
    },
    features: {
      type: 'Features',
      props: {
        id: `Features-preview-${timestamp}`,
        title: profile.featuresTitle,
        features,
        columns: 3,
      },
    },
    products: {
      type: 'ProductGrid',
      props: {
        id: `ProductGrid-preview-${timestamp}`,
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
        id: `Newsletter-preview-${timestamp}`,
        title: profile.newsletterTitle,
        description: profile.newsletterDescription,
        buttonText: 'Subscribe',
        placeholder: 'Enter your email',
      },
    },
  } as Record<(typeof profile.contentOrder)[number], Data['content'][number]>;
  const footer = {
    type: 'Footer',
    props: {
      id: `Footer-preview-${timestamp}`,
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
  } as Data['content'][number];
  return {
    content: [
      header,
      ...profile.contentOrder.map((section) => sections[section]),
      footer,
    ],
    root: { props: { title: 'Home' } },
    zones: {},
  };
}

import type { Data } from '@puckeditor/core';
import { getInitialTemplateProfile } from '@/lib/initial-template-profiles';
import { buildCuratedCopy } from '@/lib/storefront-defaults/build-curated-copy';
import { buildCuratedFeatures } from '@/lib/storefront-defaults/build-curated-features';
import { buildCuratedHero } from '@/lib/storefront-defaults/build-curated-hero';

// biome-ignore lint/suspicious/useAwait: preview call contract remains awaitable
export async function generatePreviewTemplate(params: {
  businessName: string;
  businessType: string;
  logoDataUri: string | null;
}): Promise<Data> {
  const profile = getInitialTemplateProfile(params.businessType);
  const copy = buildCuratedCopy({
    businessName: params.businessName,
    businessType: params.businessType,
    country: '',
  });
  const hero = buildCuratedHero(params.businessType, copy.hero);
  const header = {
    type: 'Header',
    props: {
      id: 'Header-home',
      showLogo: true,
      showSearch: true,
      showCart: true,
      showMenu: true,
      sticky: true,
      navigationLinks: [...copy.header.navigationLinks],
      ctaButton: copy.header.ctaButton,
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
        id: 'Text-story',
        title: copy.story.title,
        content: copy.story.content,
        align: profile.storyAlign,
      },
    },
    features: {
      type: 'Features',
      props: {
        id: 'Features-trust',
        title: copy.features.title,
        features: buildCuratedFeatures(copy.features.items),
        columns: 3,
      },
    },
    products: {
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
    newsletter: {
      type: 'Newsletter',
      props: {
        id: 'Newsletter-home',
        title: copy.newsletter.title,
        description: copy.newsletter.description,
        buttonText: copy.newsletter.buttonText,
        placeholder: copy.newsletter.placeholder,
      },
    },
  } as Record<(typeof profile.contentOrder)[number], Data['content'][number]>;
  const footer = {
    type: 'Footer',
    props: {
      id: 'Footer-home',
      showQuickLinks: true,
      quickLinks: copy.footer.quickLinks,
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

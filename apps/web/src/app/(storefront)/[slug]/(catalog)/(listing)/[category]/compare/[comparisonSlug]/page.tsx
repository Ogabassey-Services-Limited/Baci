import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getIndexableRobotsMetadata } from '@/lib/seo-utils';
import { loadComparePage } from '@/lib/storefront-compare/load-compare-page';
import { ComparePageContent } from './compare-page-content';

interface ComparePageRouteProps {
  params: Promise<{
    slug: string;
    category: string;
    comparisonSlug: string;
  }>;
}

const NON_INDEXABLE_COMPARE_ROBOTS: Metadata['robots'] = {
  index: false,
  follow: true,
  googleBot: {
    index: false,
    follow: true,
    'max-image-preview': 'large',
    'max-snippet': -1,
    'max-video-preview': -1,
  },
  'max-image-preview': 'large',
  'max-snippet': -1,
  'max-video-preview': -1,
};

export async function generateMetadata({
  params,
}: ComparePageRouteProps): Promise<Metadata> {
  const resolvedParams = await params;
  const page = await loadComparePage({
    merchantSlug: resolvedParams.slug,
    categorySlug: resolvedParams.category,
    comparisonSlug: resolvedParams.comparisonSlug,
  });

  if (!page || (!page.isIndexable && !page.isLegacyFallback)) {
    notFound();
  }

  return {
    title: { absolute: page.metaTitle },
    description: page.metaDescription,
    alternates: {
      canonical: page.canonicalUrl,
    },
    robots: page.isIndexable
      ? getIndexableRobotsMetadata()
      : NON_INDEXABLE_COMPARE_ROBOTS,
  };
}

export default function ComparePage(props: ComparePageRouteProps) {
  return <ComparePageContent {...props} />;
}

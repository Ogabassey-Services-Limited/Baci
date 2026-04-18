import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ProductGridSkeleton } from '@/components/ui/skeletons';
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

export async function generateMetadata({
  params,
}: ComparePageRouteProps): Promise<Metadata> {
  const resolvedParams = await params;
  const page = await loadComparePage({
    merchantSlug: resolvedParams.slug,
    categorySlug: resolvedParams.category,
    comparisonSlug: resolvedParams.comparisonSlug,
  });

  if (!page?.isIndexable) {
    notFound();
  }

  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: {
      canonical: page.canonicalUrl,
    },
    robots: getIndexableRobotsMetadata(),
  };
}

export default function ComparePage(props: ComparePageRouteProps) {
  return (
    <Suspense fallback={<ProductGridSkeleton count={4} columns={2} />}>
      <ComparePageContent {...props} />
    </Suspense>
  );
}

import { notFound, permanentRedirect } from 'next/navigation';
import { getCachedBlogPost } from '@/lib/cached-data';
import { buildCanonicalBlogPostUrl } from '../../../../[postSlug]/blog-post-content';

interface PageProps {
  params: Promise<{
    slug: string;
    year: string;
    month: string;
    day: string;
    postSlug: string;
  }>;
}

export default async function DatedBlogPostRedirectPage({ params }: PageProps) {
  const { slug, postSlug } = await params;
  const data = await getCachedBlogPost(slug, postSlug, false);

  if (!data) {
    notFound();
  }

  permanentRedirect(
    buildCanonicalBlogPostUrl(data.merchant, data.post.slug) as never
  );
}

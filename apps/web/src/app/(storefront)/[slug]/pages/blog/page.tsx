import { notFound } from 'next/navigation';
import {
  type BlogPost,
  OgabasseyV2Blog,
} from '@/components/storefront/ogabassey/pages/blog';
import { getCachedBlogListing } from '@/lib/cached-data';

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getBlogData(merchantSlug: string) {
  const result = await getCachedBlogListing(merchantSlug);
  if (!result) return null;

  return {
    merchant: result.merchant,
    posts: result.posts as BlogPost[],
    categories: result.categories,
  };
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const data = await getBlogData(slug);

  if (!data) {
    return { title: 'Blog - Not Found' };
  }

  return {
    title: `Blog | ${data.merchant.business_name}`,
    description: `Read the latest articles, tips, and insights from ${data.merchant.business_name}.`,
  };
}

export default async function BlogPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getBlogData(slug);

  if (!data) {
    notFound();
  }

  return (
    <OgabasseyV2Blog
      posts={data.posts}
      merchantSlug={slug}
      categories={data.categories}
    />
  );
}

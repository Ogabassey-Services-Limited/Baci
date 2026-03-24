import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import {
  type BlogPost,
  OgabasseyV2Blog,
} from '@/components/storefront/ogabassey/pages/blog';
import { createClient } from '@/lib/supabase/server';

interface PageProps {
  params: Promise<{ slug: string }>;
}

const getBlogData = cache(async (merchantSlug: string) => {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // Get merchant
  const { data: merchant } = await supabase
    .from('merchants')
    .select('id, business_name, slug')
    .eq('slug', merchantSlug)
    .single();

  if (!merchant) return null;

  // Check if blog is enabled
  const { data: features } = await supabase
    .from('merchant_feature_settings')
    .select('blog_enabled')
    .eq('merchant_id', merchant.id)
    .single();

  if (!features?.blog_enabled) return null;

  // Fetch published posts
  const { data: posts } = await supabase
    .from('blog_posts')
    .select(
      'id, title, slug, excerpt, featured_image_url, category, author_name, published_at, reading_time_minutes'
    )
    .eq('merchant_id', merchant.id)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(50);

  // Get unique categories
  const categories = [
    ...new Set(posts?.map((p) => p.category).filter(Boolean)),
  ];

  return {
    merchant,
    posts: (posts || []) as BlogPost[],
    categories,
  };
});

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

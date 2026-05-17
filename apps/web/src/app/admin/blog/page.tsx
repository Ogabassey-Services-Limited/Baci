import { redirect } from 'next/navigation';
import { BlogListClient } from '@/app/admin/blog/blog-list-client';
import type { PlatformAdminBlogPostSummary } from '@/app/admin/blog/blog-types';
import { getPlatformAdminAuth } from '@/lib/platform-admin-auth';
import { createClient } from '@/lib/supabase/server';

export default async function AdminBlogPage() {
  const auth = await getPlatformAdminAuth();
  if (auth.status === 'unauthenticated') {
    redirect('/login?redirect=%2Fadmin');
  }

  if (auth.status === 'forbidden') {
    redirect('/dashboard');
  }

  let initialError: string | null = null;
  let initialPosts: PlatformAdminBlogPostSummary[] = [];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('blog_posts')
      .select(
        'id, title, slug, excerpt, featured_image_url, category, status, author_name, reading_time_minutes, view_count, created_at, updated_at, published_at'
      )
      .eq('is_platform_post', true)
      .is('merchant_id', null)
      .order('created_at', { ascending: false })
      .range(0, 99);

    if (error) {
      console.error('Failed to load platform blog posts:', error);
      initialError = 'Failed to load platform blog posts';
    } else {
      initialPosts = (data ?? []) as PlatformAdminBlogPostSummary[];
    }
  } catch (error) {
    console.error('Platform blog admin page load error:', error);
    initialError = 'Failed to load platform blog posts';
  }

  return (
    <BlogListClient initialPosts={initialPosts} initialError={initialError} />
  );
}

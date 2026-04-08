import { PenTool } from 'lucide-react';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getCachedFeatureSettings } from '@/lib/cached-data';
import { getMerchantForUser } from '@/lib/merchant-server';
import { createClient } from '@/lib/supabase/server';
import {
  BlogClientPage,
  type BlogClientPageProps,
  type BlogPost,
} from './blog-client-page';

export default async function BlogPage() {
  const { merchant } = await getMerchantForUser();

  if (!merchant) {
    return <div>Merchant not found</div>;
  }

  // Fetch settings to gate access — treat fetch failure as "blog disabled"
  let blogEnabled = false;
  try {
    const settings = await getCachedFeatureSettings(merchant.id);
    blogEnabled = settings?.blog_enabled ?? false;
  } catch {
    // Settings query failed — default to disabled
  }

  if (!blogEnabled) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Blog</h1>
          <p className="text-muted-foreground">
            Create and manage blog posts for your store
          </p>
        </div>

        <Card>
          <CardContent className="py-16">
            <div className="text-center max-w-md mx-auto">
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-6">
                <PenTool className="w-8 h-8 text-accent" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Blog Feature</h2>
              <p className="text-muted-foreground mb-6">
                Create blog posts to drive traffic, improve SEO, and rank on
                Google Discover. Enable the blog feature to get started.
              </p>
              <Button asChild>
                <Link href="/dashboard/settings">Enable Blog Feature</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Prefetch initial data server-side to eliminate loading jump
  let initialData: {
    posts: BlogPost[];
    counts: BlogClientPageProps['initialCounts'];
  } = {
    posts: [],
    counts: undefined,
  };
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // We fetch from the database directly since we are on the server
    const { data: posts, error: postsError } = await supabase
      .from('blog_posts')
      .select(
        'id, title, slug, excerpt, featured_image_url, category, status, author_name, view_count, reading_time_minutes, created_at, updated_at, published_at'
      )
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false })
      .range(0, 19);
    if (postsError) {
      throw postsError;
    }

    const [
      { count: total, error: totalError },
      { count: published, error: publishedError },
      { count: draft, error: draftError },
      { count: archived, error: archivedError },
    ] = await Promise.all([
      supabase
        .from('blog_posts')
        // PERFORMANCE: Use .select('id') instead of .select('*') for COUNT queries to prevent overfetching full rows
        .select('id', { count: 'exact', head: true })
        .eq('merchant_id', merchant.id),
      supabase
        .from('blog_posts')
        // PERFORMANCE: Use .select('id') instead of .select('*') for COUNT queries to prevent overfetching full rows
        .select('id', { count: 'exact', head: true })
        .eq('merchant_id', merchant.id)
        .eq('status', 'published'),
      supabase
        .from('blog_posts')
        // PERFORMANCE: Use .select('id') instead of .select('*') for COUNT queries to prevent overfetching full rows
        .select('id', { count: 'exact', head: true })
        .eq('merchant_id', merchant.id)
        .eq('status', 'draft'),
      supabase
        .from('blog_posts')
        // PERFORMANCE: Use .select('id') instead of .select('*') for COUNT queries to prevent overfetching full rows
        .select('id', { count: 'exact', head: true })
        .eq('merchant_id', merchant.id)
        .eq('status', 'archived'),
    ]);
    const countError =
      totalError ?? publishedError ?? draftError ?? archivedError;
    if (countError) {
      throw countError;
    }

    initialData = {
      posts: posts || [],
      counts: {
        total: total || 0,
        published: published || 0,
        draft: draft || 0,
        archived: archived || 0,
      },
    };
  } catch (error) {
    console.error('Error prefetching blog data:', error);
  }

  return (
    <BlogClientPage
      merchant={merchant}
      initialPosts={initialData.posts}
      initialCounts={initialData.counts}
    />
  );
}

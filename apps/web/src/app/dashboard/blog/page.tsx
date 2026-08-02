import { getMerchantForUser } from '@/lib/merchant-server';
import { createClient } from '@/lib/supabase/server';
import {
  BlogClientPage,
  type BlogClientPageProps,
  type BlogPost,
} from './blog-client-page';

const DASHBOARD_BLOG_POST_SELECT =
  'id, title, slug, excerpt, featured_image_url, featured_image_width, featured_image_height, featured_image_variants, category, status, author_name, view_count, reading_time_minutes, created_at, updated_at, published_at';

type BlogInitialData = {
  posts: BlogPost[];
  counts: BlogClientPageProps['initialCounts'];
};

// Prefetch initial data server-side to eliminate loading jump.
// Module-scope helper keeps throw-inside-try out of the component body so
// React Compiler can process the page component.
async function fetchInitialBlogData(
  merchantId: string
): Promise<BlogInitialData> {
  try {
    const supabase = await createClient();

    // We fetch from the database directly since we are on the server
    const { data: posts, error: postsError } = await supabase
      .from('blog_posts')
      .select(DASHBOARD_BLOG_POST_SELECT)
      .eq('merchant_id', merchantId)
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
        .eq('merchant_id', merchantId),
      supabase
        .from('blog_posts')
        // PERFORMANCE: Use .select('id') instead of .select('*') for COUNT queries to prevent overfetching full rows
        .select('id', { count: 'exact', head: true })
        .eq('merchant_id', merchantId)
        .eq('status', 'published'),
      supabase
        .from('blog_posts')
        // PERFORMANCE: Use .select('id') instead of .select('*') for COUNT queries to prevent overfetching full rows
        .select('id', { count: 'exact', head: true })
        .eq('merchant_id', merchantId)
        .eq('status', 'draft'),
      supabase
        .from('blog_posts')
        // PERFORMANCE: Use .select('id') instead of .select('*') for COUNT queries to prevent overfetching full rows
        .select('id', { count: 'exact', head: true })
        .eq('merchant_id', merchantId)
        .eq('status', 'archived'),
    ]);
    const countError =
      totalError ?? publishedError ?? draftError ?? archivedError;
    if (countError) {
      throw countError;
    }

    return {
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
    return { posts: [], counts: undefined };
  }
}

export default async function BlogPage() {
  const { merchant } = await getMerchantForUser();

  if (!merchant) {
    return <div>Merchant not found</div>;
  }

  const initialData = await fetchInitialBlogData(merchant.id);

  return (
    <BlogClientPage
      merchant={merchant}
      initialPosts={initialData.posts}
      initialCounts={initialData.counts}
    />
  );
}

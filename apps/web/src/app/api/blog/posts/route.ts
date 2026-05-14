import { createClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * Platform Blog Posts API - Public Read-Only
 *
 * GET: List all published platform blog posts
 */

// Validate required environment variables
if (
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
) {
  throw new Error('Missing required Supabase environment variables');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Parse query params
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const tag = searchParams.get('tag');
    // Validate numeric params: clamp to safe range, default on NaN
    const limit = Math.min(
      Math.max(Number.parseInt(searchParams.get('limit') || '20', 10) || 20, 1),
      100
    );
    const offset = Math.max(
      Number.parseInt(searchParams.get('offset') || '0', 10) || 0,
      0
    );
    const slug = searchParams.get('slug');

    // If slug is provided, fetch single post
    if (slug) {
      const { data: post, error } = await supabase
        .from('blog_posts')
        .select(
          'id, merchant_id, title, slug, content, excerpt, featured_image_url, featured_image_alt, category, tags, keywords, author_name, author_title, author_image_url, author_bio, status, seo_title, seo_description, focus_keyword, reading_time_minutes, view_count, word_count, created_at, updated_at, published_at, is_ai_generated, ai_topic_id, is_platform_post'
        )
        .eq('is_platform_post', true)
        .eq('status', 'published')
        .not('published_at', 'is', null)
        .eq('slug', slug)
        .single();

      if (error) {
        // PGRST116 = "no rows returned" - this is a true 404
        if ((error as { code?: string }).code === 'PGRST116') {
          return NextResponse.json(
            { error: 'Post not found' },
            { status: 404 }
          );
        }
        // Other errors are server errors - don't expose internal details
        console.error('Error fetching blog post:', error);
        return NextResponse.json(
          { error: 'Failed to fetch blog post' },
          { status: 500 }
        );
      }

      if (!post) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }

      // Increment view count (fire and forget with silent error handling)
      void (async () => {
        try {
          await supabase.rpc('increment_blog_post_views', {
            p_post_id: post.id,
          });
        } catch {
          // Silently ignore view count errors - non-critical
        }
      })();

      return NextResponse.json(post);
    }

    // Build query for listing posts
    let query = supabase
      .from('blog_posts')
      .select(
        'id, title, slug, excerpt, featured_image_url, featured_image_alt, category, tags, author_name, author_image_url, reading_time_minutes, published_at, view_count',
        { count: 'exact' }
      )
      .eq('is_platform_post', true)
      .eq('status', 'published')
      .not('published_at', 'is', null);

    // Apply filters
    if (category) {
      query = query.eq('category', category);
    }

    if (tag) {
      query = query.contains('tags', [tag]);
    }

    // Sort by published date
    query = query.order('published_at', { ascending: false });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: posts, error, count } = await query;

    if (error) {
      console.error('Error fetching blog posts:', error);
      // Don't expose internal DB error messages to clients
      return NextResponse.json(
        { error: 'Failed to fetch blog posts' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      posts: posts || [],
      total: count || 0,
      limit,
      offset,
      hasMore: (count || 0) > offset + limit,
    });
  } catch (error) {
    console.error('Blog posts GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

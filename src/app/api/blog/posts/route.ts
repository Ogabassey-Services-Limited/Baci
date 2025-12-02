import { createClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * Platform Blog Posts API - Public Read-Only
 *
 * GET: List all published platform blog posts
 */

// Validate required environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
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
    const limit = Number.parseInt(searchParams.get('limit') || '20', 10);
    const offset = Number.parseInt(searchParams.get('offset') || '0', 10);
    const slug = searchParams.get('slug');

    // If slug is provided, fetch single post
    if (slug) {
      const { data: post, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('is_platform_post', true)
        .eq('status', 'published')
        .eq('slug', slug)
        .single();

      if (error || !post) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }

      // Increment view count (fire and forget)
      supabase.rpc('increment_blog_post_views', { p_post_id: post.id });

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
      .eq('status', 'published');

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
      return NextResponse.json({ error: error.message }, { status: 500 });
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

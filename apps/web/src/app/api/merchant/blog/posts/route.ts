import { type NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRoleKey } from '@/env';
import {
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
} from '@/lib/api-auth';
import {
  calculateReadingTime,
  calculateWordCount,
  extractKeywords,
  generateExcerpt,
  generateSeoDescription,
  generateSlug,
} from '@/lib/blog-utils';
import { revalidateBlogPosts } from '@/lib/cache-revalidation';
import { checkCsrfProtection } from '@/lib/csrf';
import { getBlogEmbeddingText } from '@/lib/embeddings';
import { createPostSchema } from '@/lib/validations/blog';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const access = await getUserAccess(auth.supabase);
    if (!access) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    if (!hasPermission(access, 'marketing', 'view')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const supabase = auth.supabase;

    // Parse query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const limit = Number.parseInt(searchParams.get('limit') || '20', 10);
    const offset = Number.parseInt(searchParams.get('offset') || '0', 10);
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') === 'asc';

    const blogPostColumns =
      'id, title, slug, excerpt, featured_image_url, category, status, author_name, view_count, reading_time_minutes, created_at, updated_at, published_at';

    // Build query
    let query = supabase
      .from('blog_posts')
      .select(blogPostColumns, { count: 'exact' })
      .eq('merchant_id', access.merchantId);

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    if (category) {
      query = query.eq('category', category);
    }

    if (search) {
      const sanitized = search.trim().slice(0, 100);
      if (sanitized) {
        // Use GIN-indexed full-text search, consistent with storefront search
        query = query.textSearch('search_vector', sanitized, {
          type: 'websearch',
          config: 'english',
        });
      }
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    // Execute posts query and counts in parallel for maximum performance
    const [
      { data: posts, error: postsError, count },
      { count: totalCount },
      { count: publishedCount },
      { count: draftCount },
      { count: archivedCount },
    ] = await Promise.all([
      // 1. Fetch posts with filters and pagination
      query,
      // 2. Fetch total count
      supabase
        .from('blog_posts')
        .select('id', { count: 'exact', head: true })
        .eq('merchant_id', access.merchantId),
      // 3. Fetch published count
      supabase
        .from('blog_posts')
        .select('id', { count: 'exact', head: true })
        .eq('merchant_id', access.merchantId)
        .eq('status', 'published'),
      // 4. Fetch draft count
      supabase
        .from('blog_posts')
        .select('id', { count: 'exact', head: true })
        .eq('merchant_id', access.merchantId)
        .eq('status', 'draft'),
      // 5. Fetch archived count
      supabase
        .from('blog_posts')
        .select('id', { count: 'exact', head: true })
        .eq('merchant_id', access.merchantId)
        .eq('status', 'archived'),
    ]);

    if (postsError) {
      console.error('Error fetching blog posts:', postsError);
      return NextResponse.json({ error: postsError.message }, { status: 500 });
    }

    return NextResponse.json({
      posts: posts || [],
      total: count || 0,
      limit,
      offset,
      hasMore: (count || 0) > offset + limit,
      counts: {
        total: totalCount || 0,
        published: publishedCount || 0,
        draft: draftCount || 0,
        archived: archivedCount || 0,
      },
    });
  } catch (error) {
    console.error('Blog posts GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { valid, response } = await checkCsrfProtection(request);
    if (!valid && response) return response;

    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const access = await getUserAccess(auth.supabase);
    if (!access) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    if (!hasPermission(access, 'marketing', 'edit')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const supabase = auth.supabase;

    // Get merchant business name if needed (optional, or we can use metadata)
    const { data: merchantData } = await supabase
      .from('merchants')
      .select('business_name')
      .eq('id', access.merchantId)
      .single();

    const merchant = {
      id: access.merchantId,
      business_name: merchantData?.business_name || 'Store Owner',
    };

    // Check if blog feature is enabled
    const { data: features } = await supabase
      .from('merchant_feature_settings')
      .select('blog_enabled')
      .eq('merchant_id', merchant.id)
      .single();

    if (!features?.blog_enabled) {
      return NextResponse.json(
        {
          error:
            'Blog feature is not enabled. Enable it in Settings > Features.',
        },
        { status: 403 }
      );
    }

    // Parse and validate body
    const body = await request.json();

    // Auto-generate slug if not provided
    if (!body.slug && body.title) {
      body.slug = generateSlug(body.title);
    }

    // Set default author name if not provided
    if (!body.author_name) {
      body.author_name = merchant.business_name;
    }

    const validated = createPostSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validated.error.flatten() },
        { status: 400 }
      );
    }

    const postData = validated.data;

    // Check if slug already exists for this merchant
    const { data: existingPost } = await supabase
      .from('blog_posts')
      .select('id')
      .eq('merchant_id', merchant.id)
      .eq('slug', postData.slug)
      .maybeSingle();

    if (existingPost) {
      return NextResponse.json(
        { error: 'A post with this slug already exists' },
        { status: 409 }
      );
    }

    // Calculate reading time and word count
    const wordCount = calculateWordCount(postData.content);
    const readingTime = calculateReadingTime(postData.content);

    // Auto-generate SEO fields if not provided
    const autoExcerpt = postData.excerpt || generateExcerpt(postData.content);
    const autoSeoTitle = postData.seo_title || postData.title.substring(0, 70);
    const autoSeoDescription =
      postData.seo_description || generateSeoDescription(postData.content);
    const autoKeywords = postData.keywords?.length
      ? postData.keywords
      : extractKeywords(postData.title, postData.content);
    const autoFocusKeyword =
      postData.focus_keyword ||
      (autoKeywords.length > 0 ? autoKeywords[0] : undefined);

    // Prepare insert data
    const insertData = {
      merchant_id: merchant.id,
      title: postData.title,
      slug: postData.slug,
      content: postData.content,
      excerpt: autoExcerpt,
      featured_image_url: postData.featured_image_url,
      featured_image_alt: postData.featured_image_alt,
      category: postData.category,
      tags: postData.tags || [],
      keywords: autoKeywords,
      author_name: postData.author_name,
      author_title: postData.author_title,
      author_image_url: postData.author_image_url,
      author_bio: postData.author_bio,
      status: postData.status || 'draft',
      seo_title: autoSeoTitle,
      seo_description: autoSeoDescription,
      focus_keyword: autoFocusKeyword,
      word_count: wordCount,
      reading_time_minutes: readingTime,
      published_at:
        postData.status === 'published' ? new Date().toISOString() : null,
    };

    const { data: newPost, error: insertError } = await supabase
      .from('blog_posts')
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating blog post:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Generate embedding asynchronously (non-blocking)
    if (newPost?.id) {
      const embeddingText = getBlogEmbeddingText({
        title: postData.title,
        excerpt: autoExcerpt,
        content: postData.content,
        category: postData.category,
      });
      const serviceRoleKey = getSupabaseServiceRoleKey();

      // Fire-and-forget: Call edge function to generate embedding
      fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-embedding`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            type: 'blog',
            id: newPost.id,
            text: embeddingText,
          }),
        }
      ).catch((err) =>
        console.error('Failed to generate blog embedding:', err)
      );
    }

    // Invalidate blog caches so storefront shows the new post immediately
    revalidateBlogPosts(merchant.id, postData.slug);

    return NextResponse.json(newPost, { status: 201 });
  } catch (error) {
    console.error('Blog posts POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

import { type NextRequest, NextResponse } from 'next/server';
import {
  validateBlogDiscoverImageReadiness,
  validateBlogImageVariantIntegrity,
} from '@/lib/blog-discover-readiness';
import { generateSlug } from '@/lib/blog-utils';
import { revalidatePlatformBlog } from '@/lib/cache-revalidation';
import { checkCsrfProtection } from '@/lib/csrf';
import { getPlatformAdminAuth } from '@/lib/platform-admin-auth';
import { createClient } from '@/lib/supabase/server';
import { createPostSchema, sanitizeBlogPostData } from '@/lib/validations/blog';

function parseSafeLimit(raw: string | null): number {
  const parsed = Number.parseInt(raw ?? '20', 10);
  if (!Number.isFinite(parsed)) {
    return 20;
  }

  return Math.min(Math.max(parsed, 1), 100);
}

function parseSafeOffset(raw: string | null): number {
  const parsed = Number.parseInt(raw ?? '0', 10);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(parsed, 0);
}

function toAuthErrorResponse(status: 'unauthenticated' | 'forbidden') {
  return status === 'unauthenticated'
    ? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    : NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

export async function GET(request: NextRequest) {
  const auth = await getPlatformAdminAuth();
  if (auth.status !== 'authenticated') {
    return toAuthErrorResponse(auth.status);
  }

  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const limit = parseSafeLimit(searchParams.get('limit'));
    const offset = parseSafeOffset(searchParams.get('offset'));

    const { data, error, count } = await supabase
      .from('blog_posts')
      .select(
        'id, title, slug, excerpt, featured_image_url, category, status, author_name, reading_time_minutes, view_count, created_at, updated_at, published_at',
        { count: 'exact' }
      )
      .eq('is_platform_post', true)
      .is('merchant_id', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Failed to fetch platform blog posts:', error);
      return NextResponse.json(
        { error: 'Failed to fetch platform blog posts' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      hasMore: (count || 0) > offset + limit,
      limit,
      offset,
      posts: data || [],
      total: count || 0,
    });
  } catch (error) {
    console.error('Platform blog posts GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await getPlatformAdminAuth();
  if (auth.status !== 'authenticated') {
    return toAuthErrorResponse(auth.status);
  }

  const { valid, response } = await checkCsrfProtection(request);
  if (!valid) {
    return (
      response ??
      NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
    );
  }

  try {
    const rawBody = await request.json();
    const body = sanitizeBlogPostData(rawBody);
    if (!body.slug && typeof body.title === 'string') {
      body.slug = generateSlug(body.title);
    }
    if (!body.author_name) {
      body.author_name = 'Baci Editorial';
    }

    const validated = createPostSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validated.error.flatten() },
        { status: 400 }
      );
    }

    const postData = validated.data;
    const variantIntegrity = validateBlogImageVariantIntegrity(postData, {
      kind: 'platform',
    });
    if (!variantIntegrity.ready) {
      return NextResponse.json(
        {
          error: 'Invalid featured image variants',
          code: variantIntegrity.code,
          details: variantIntegrity.details,
        },
        { status: 400 }
      );
    }

    if (postData.status === 'published') {
      const discoverReadiness = validateBlogDiscoverImageReadiness(postData, {
        kind: 'platform',
      });
      if (!discoverReadiness.ready) {
        return NextResponse.json(
          {
            error: 'Featured image is not Discover-ready',
            code: discoverReadiness.code,
            details: discoverReadiness.details,
          },
          { status: 400 }
        );
      }
    }

    const publishedAt =
      postData.status === 'published' ? new Date().toISOString() : null;

    const insertData = {
      ...postData,
      is_platform_post: true,
      keywords: postData.keywords || [],
      merchant_id: null,
      published_at: publishedAt,
      status: postData.status || 'draft',
      tags: postData.tags || [],
    };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('blog_posts')
      .insert(insertData)
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A post with this slug already exists' },
          { status: 409 }
        );
      }

      console.error('Failed to create platform blog post:', error);
      return NextResponse.json(
        { error: 'Failed to create platform blog post' },
        { status: 500 }
      );
    }

    revalidatePlatformBlog(data.slug);
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Platform blog posts POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

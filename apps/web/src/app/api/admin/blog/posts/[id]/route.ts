import { type NextRequest, NextResponse } from 'next/server';
import {
  validateBlogDiscoverImageReadiness,
  validateBlogImageVariantIntegrity,
} from '@/lib/blog-discover-readiness';
import { revalidatePlatformBlog } from '@/lib/cache-revalidation';
import { checkCsrfProtection } from '@/lib/csrf';
import { getPlatformAdminAuth } from '@/lib/platform-admin-auth';
import { createClient } from '@/lib/supabase/server';
import { blogPostSchema, sanitizeBlogPostData } from '@/lib/validations/blog';

const PLATFORM_BLOG_DETAIL_SELECT =
  'id, title, slug, content, excerpt, featured_image_url, featured_image_alt, featured_image_width, featured_image_height, featured_image_variants, category, tags, keywords, author_name, author_title, author_image_url, author_bio, status, seo_title, seo_description, focus_keyword, word_count, reading_time_minutes, view_count, created_at, updated_at, published_at';

interface RouteParams {
  params: Promise<{ id: string }>;
}

function toAuthErrorResponse(status: 'unauthenticated' | 'forbidden') {
  return status === 'unauthenticated'
    ? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    : NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

function hasFeaturedImageFields(value: Record<string, unknown>): boolean {
  return (
    Object.hasOwn(value, 'featured_image_url') ||
    Object.hasOwn(value, 'featured_image_width') ||
    Object.hasOwn(value, 'featured_image_height') ||
    Object.hasOwn(value, 'featured_image_variants')
  );
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await getPlatformAdminAuth();
  if (auth.status !== 'authenticated') {
    return toAuthErrorResponse(auth.status);
  }

  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('blog_posts')
      .select(PLATFORM_BLOG_DETAIL_SELECT)
      .eq('id', id)
      .eq('is_platform_post', true)
      .is('merchant_id', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }

      console.error('Failed to fetch platform blog post:', error);
      return NextResponse.json(
        { error: 'Failed to fetch platform blog post' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Platform blog post GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
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
    const { id } = await params;
    const body = sanitizeBlogPostData(await request.json());
    const validated = blogPostSchema.partial().safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validated.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: existingPost, error: existingError } = await supabase
      .from('blog_posts')
      .select(
        'id, slug, status, featured_image_url, featured_image_width, featured_image_height, featured_image_variants'
      )
      .eq('id', id)
      .eq('is_platform_post', true)
      .is('merchant_id', null)
      .single();

    if (existingError) {
      if (existingError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }

      console.error(
        'Failed to fetch existing platform blog post:',
        existingError
      );
      return NextResponse.json(
        { error: 'Failed to update platform blog post' },
        { status: 500 }
      );
    }

    const targetStatus =
      typeof validated.data.status === 'string'
        ? validated.data.status
        : existingPost.status;
    const effectiveImage = {
      featured_image_height:
        validated.data.featured_image_height === undefined
          ? existingPost.featured_image_height
          : validated.data.featured_image_height,
      featured_image_url:
        validated.data.featured_image_url === undefined
          ? existingPost.featured_image_url
          : validated.data.featured_image_url,
      featured_image_variants:
        validated.data.featured_image_variants === undefined
          ? (existingPost.featured_image_variants ?? {})
          : validated.data.featured_image_variants,
      featured_image_width:
        validated.data.featured_image_width === undefined
          ? existingPost.featured_image_width
          : validated.data.featured_image_width,
    };

    const variantIntegrity = validateBlogImageVariantIntegrity(effectiveImage, {
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

    const publishingNow =
      targetStatus === 'published' && existingPost.status !== 'published';
    if (
      targetStatus === 'published' &&
      (publishingNow || hasFeaturedImageFields(body))
    ) {
      const discoverReadiness = validateBlogDiscoverImageReadiness(
        effectiveImage,
        { kind: 'platform' }
      );
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

    const shouldSetPublishedAt =
      validated.data.status === 'published' &&
      existingPost.status !== 'published' &&
      !validated.data.published_at;

    const updateData = {
      ...validated.data,
      is_platform_post: true,
      merchant_id: null,
      ...(shouldSetPublishedAt
        ? { published_at: new Date().toISOString() }
        : {}),
    };

    const { data, error } = await supabase
      .from('blog_posts')
      .update(updateData)
      .eq('id', id)
      .eq('is_platform_post', true)
      .is('merchant_id', null)
      .select(PLATFORM_BLOG_DETAIL_SELECT)
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A post with this slug already exists' },
          { status: 409 }
        );
      }

      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }

      console.error('Failed to update platform blog post:', error);
      return NextResponse.json(
        { error: 'Failed to update platform blog post' },
        { status: 500 }
      );
    }

    revalidatePlatformBlog(data.slug);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Platform blog post PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const auth = await getPlatformAdminAuth();
  if (auth.status !== 'authenticated') {
    return toAuthErrorResponse(auth.status);
  }

  const { valid, response } = await checkCsrfProtection(_request);
  if (!valid) {
    return (
      response ??
      NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
    );
  }

  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: existing, error: existingError } = await supabase
      .from('blog_posts')
      .select('slug')
      .eq('id', id)
      .eq('is_platform_post', true)
      .is('merchant_id', null)
      .single();

    if (existingError) {
      if (existingError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }

      console.error('Failed to fetch post for deletion:', existingError);
      return NextResponse.json(
        { error: 'Failed to delete platform blog post' },
        { status: 500 }
      );
    }

    const { error } = await supabase
      .from('blog_posts')
      .delete()
      .eq('id', id)
      .eq('is_platform_post', true)
      .is('merchant_id', null);

    if (error) {
      console.error('Failed to delete platform blog post:', error);
      return NextResponse.json(
        { error: 'Failed to delete platform blog post' },
        { status: 500 }
      );
    }

    revalidatePlatformBlog(existing.slug);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Platform blog post DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

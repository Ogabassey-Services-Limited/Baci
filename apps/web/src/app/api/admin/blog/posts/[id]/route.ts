import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  validateBlogDiscoverImageReadiness,
  validateBlogImageVariantIntegrity,
} from '@/lib/blog-discover-readiness';
import { calculateReadingTime, calculateWordCount } from '@/lib/blog-utils';
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

const platformBlogRouteParamsSchema = z.object({
  id: z.string().min(1),
});

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
    const parsedParams = platformBlogRouteParamsSchema.safeParse(await params);
    if (!parsedParams.success) {
      return NextResponse.json(
        {
          error: 'Invalid route parameters',
          details: parsedParams.error.flatten(),
        },
        { status: 400 }
      );
    }
    const { id } = parsedParams.data;
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
    const parsedParams = platformBlogRouteParamsSchema.safeParse(await params);
    if (!parsedParams.success) {
      return NextResponse.json(
        {
          error: 'Invalid route parameters',
          details: parsedParams.error.flatten(),
        },
        { status: 400 }
      );
    }
    const { id } = parsedParams.data;
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

    const updateData: Record<string, unknown> = { ...validated.data };
    const featuredImageUrlChanged =
      Object.hasOwn(updateData, 'featured_image_url') &&
      updateData.featured_image_url !== existingPost.featured_image_url;
    if (featuredImageUrlChanged) {
      // A new primary image invalidates dimensions and variants unless
      // replacement metadata is supplied in this PATCH payload.
      if (!Object.hasOwn(updateData, 'featured_image_width')) {
        updateData.featured_image_width = null;
      }
      if (!Object.hasOwn(updateData, 'featured_image_height')) {
        updateData.featured_image_height = null;
      }
      if (!Object.hasOwn(updateData, 'featured_image_variants')) {
        updateData.featured_image_variants = {};
      }
    }

    const targetStatus =
      typeof updateData.status === 'string'
        ? updateData.status
        : existingPost.status;
    const effectiveImage = {
      featured_image_height:
        updateData.featured_image_height === undefined
          ? existingPost.featured_image_height
          : (updateData.featured_image_height as number | null),
      featured_image_url:
        updateData.featured_image_url === undefined
          ? existingPost.featured_image_url
          : (updateData.featured_image_url as string | null),
      featured_image_variants:
        updateData.featured_image_variants === undefined
          ? (existingPost.featured_image_variants ?? {})
          : ((updateData.featured_image_variants as Record<
              string,
              unknown
            > | null) ?? {}),
      featured_image_width:
        updateData.featured_image_width === undefined
          ? existingPost.featured_image_width
          : (updateData.featured_image_width as number | null),
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
      updateData.status === 'published' &&
      existingPost.status !== 'published' &&
      !updateData.published_at;

    if (typeof updateData.content === 'string') {
      updateData.word_count = calculateWordCount(updateData.content);
      updateData.reading_time_minutes = calculateReadingTime(
        updateData.content
      );
    }

    const finalUpdateData = {
      ...updateData,
      is_platform_post: true,
      merchant_id: null,
      ...(shouldSetPublishedAt
        ? { published_at: new Date().toISOString() }
        : {}),
    };

    const { data, error } = await supabase
      .from('blog_posts')
      .update(finalUpdateData)
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

    const previousSlug =
      typeof existingPost.slug === 'string'
        ? existingPost.slug.trim().toLowerCase()
        : '';
    const nextSlug =
      typeof data.slug === 'string' ? data.slug.trim().toLowerCase() : '';

    if (previousSlug && previousSlug !== nextSlug) {
      revalidatePlatformBlog(previousSlug);
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
    const parsedParams = platformBlogRouteParamsSchema.safeParse(await params);
    if (!parsedParams.success) {
      return NextResponse.json(
        {
          error: 'Invalid route parameters',
          details: parsedParams.error.flatten(),
        },
        { status: 400 }
      );
    }
    const { id } = parsedParams.data;
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

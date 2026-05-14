import { type NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRoleKey } from '@/env';
import {
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
} from '@/lib/api-auth';
import {
  validateBlogDiscoverImageReadiness,
  validateBlogImageVariantIntegrity,
} from '@/lib/blog-discover-readiness';
import { calculateReadingTime, calculateWordCount } from '@/lib/blog-utils';
import { revalidateBlogPosts } from '@/lib/cache-revalidation';
import { checkCsrfProtection } from '@/lib/csrf';
import { getBlogEmbeddingText } from '@/lib/embeddings';
import { getMerchantBlogRevalidationContext } from '@/lib/get-merchant-blog-cache-identifiers';
import { blogPostSchema, sanitizeBlogPostData } from '@/lib/validations/blog';

interface RouteParams {
  params: Promise<{ id: string }>;
}

function getFeaturedImageVariants(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function normalizeJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeJsonValue);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nestedValue]) => [key, normalizeJsonValue(nestedValue)])
  );
}

function featuredImageVariantsEqual(left: unknown, right: unknown): boolean {
  return (
    JSON.stringify(normalizeJsonValue(getFeaturedImageVariants(left))) ===
    JSON.stringify(normalizeJsonValue(getFeaturedImageVariants(right)))
  );
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const auth = await authenticateApiRequest(_request);
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

    // Get blog post
    const { data: post, error } = await supabase
      .from('blog_posts')
      .select(
        'id, title, slug, content, excerpt, featured_image_url, featured_image_alt, featured_image_width, featured_image_height, featured_image_variants, category, tags, keywords, author_name, author_title, author_image_url, author_bio, status, seo_title, seo_description, focus_keyword, word_count, reading_time_minutes, view_count, created_at, updated_at, published_at'
      )
      .eq('id', id)
      .eq('merchant_id', access.merchantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }
      console.error('Error fetching blog post:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }

    return NextResponse.json(post);
  } catch (error) {
    console.error('Blog post GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    // CSRF protection
    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(request);
    if (!csrfValid) {
      return (
        csrfResponse ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const { id } = await params;
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

    // Get existing post
    const { data: existingPost, error: fetchError } = await supabase
      .from('blog_posts')
      .select(
        'id, slug, status, content, title, excerpt, category, published_at, featured_image_url, featured_image_width, featured_image_height, featured_image_variants'
      )
      .eq('id', id)
      .eq('merchant_id', access.merchantId)
      .single();

    if (fetchError || !existingPost) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Parse and validate body
    const body = sanitizeBlogPostData(await request.json());
    const validated = blogPostSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validated.error.flatten() },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = { ...validated.data };
    const featuredImageUrlChanged =
      Object.hasOwn(updateData, 'featured_image_url') &&
      updateData.featured_image_url !== existingPost.featured_image_url;
    if (featuredImageUrlChanged) {
      // A new primary image invalidates dimensions and variants unless the
      // client submits replacement metadata in this PATCH.
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
    const featureSettings = await supabase
      .from('merchant_feature_settings')
      .select('blog_enabled, blog_discover_image_validation_enabled')
      .eq('merchant_id', access.merchantId)
      .maybeSingle();
    if (featureSettings.error) {
      console.warn(
        'Failed to load blog feature settings for discover enforcement',
        {
          merchantId: access.merchantId,
          error: featureSettings.error.message,
        }
      );
    }
    const shouldEnforceDiscoverImage =
      featureSettings.data?.blog_discover_image_validation_enabled === true;
    const variantIntegrity = validateBlogImageVariantIntegrity(
      updateData,
      access.merchantId
    );
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
    const targetStatus =
      typeof updateData.status === 'string'
        ? updateData.status
        : existingPost.status;
    const featuredImageMetadataChanged =
      (Object.hasOwn(updateData, 'featured_image_width') &&
        updateData.featured_image_width !==
          existingPost.featured_image_width) ||
      (Object.hasOwn(updateData, 'featured_image_height') &&
        updateData.featured_image_height !==
          existingPost.featured_image_height) ||
      (Object.hasOwn(updateData, 'featured_image_variants') &&
        !featuredImageVariantsEqual(
          updateData.featured_image_variants,
          existingPost.featured_image_variants
        ));
    const featuredImageChanged =
      featuredImageUrlChanged || featuredImageMetadataChanged;
    const publishingNow =
      targetStatus === 'published' && existingPost.status !== 'published';
    const effectiveImage = {
      featured_image_url:
        updateData.featured_image_url === undefined
          ? existingPost.featured_image_url
          : (updateData.featured_image_url as string | null),
      featured_image_width:
        updateData.featured_image_width === undefined
          ? existingPost.featured_image_width
          : (updateData.featured_image_width as number | null),
      featured_image_height:
        updateData.featured_image_height === undefined
          ? existingPost.featured_image_height
          : (updateData.featured_image_height as number | null),
      featured_image_variants:
        updateData.featured_image_variants === undefined
          ? (existingPost.featured_image_variants ?? {})
          : ((updateData.featured_image_variants as Record<
              string,
              unknown
            > | null) ?? {}),
    };
    const discoverImageReadiness =
      targetStatus === 'published'
        ? validateBlogDiscoverImageReadiness(effectiveImage, access.merchantId)
        : { ready: true as const };

    if (
      !discoverImageReadiness.ready &&
      shouldEnforceDiscoverImage &&
      (publishingNow || featuredImageChanged)
    ) {
      return NextResponse.json(
        {
          error: 'Featured image is not Discover-ready',
          code: discoverImageReadiness.code,
          details: discoverImageReadiness.details,
        },
        { status: 400 }
      );
    }

    // Check if slug is being changed and already exists
    if (updateData.slug && updateData.slug !== existingPost.slug) {
      const { data: slugExists } = await supabase
        .from('blog_posts')
        .select('id')
        .eq('merchant_id', access.merchantId)
        .eq('slug', updateData.slug)
        .neq('id', id)
        .maybeSingle();

      if (slugExists) {
        return NextResponse.json(
          { error: 'A post with this slug already exists' },
          { status: 409 }
        );
      }
    }

    // Recalculate reading time and word count if content changed
    if (updateData.content) {
      updateData.word_count = calculateWordCount(updateData.content as string);
      updateData.reading_time_minutes = calculateReadingTime(
        updateData.content as string
      );
    }

    // Set published_at if status is changing to published and no date provided
    if (
      updateData.status === 'published' &&
      existingPost.status !== 'published' &&
      !updateData.published_at
    ) {
      updateData.published_at = new Date().toISOString();
    }

    const blogRevalidation = await getMerchantBlogRevalidationContext(
      supabase,
      access.merchantId
    );

    // Update post
    const { data: updatedPost, error: updateError } = await supabase
      .from('blog_posts')
      .update(updateData)
      .eq('id', id)
      .eq('merchant_id', access.merchantId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating blog post:', updateError);
      return NextResponse.json(
        { error: 'Failed to update post' },
        { status: 500 }
      );
    }

    // Regenerate embedding if content, title, or excerpt changed
    if (
      updatedPost &&
      (updateData.content || updateData.title || updateData.excerpt)
    ) {
      const embeddingText = getBlogEmbeddingText({
        title: updatedPost.title,
        excerpt: updatedPost.excerpt,
        content: updatedPost.content,
        category: updatedPost.category,
      });
      const serviceRoleKey = getSupabaseServiceRoleKey();

      // Fire-and-forget: Call edge function to regenerate embedding
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
            id: updatedPost.id,
            text: embeddingText,
          }),
        }
      ).catch((err) =>
        console.error('Failed to regenerate blog embedding:', err)
      );
    }

    // Invalidate blog caches so storefront reflects changes immediately
    revalidateBlogPosts({
      identifiers: blogRevalidation.identifiers,
      canonicalMerchantSlug: blogRevalidation.canonicalMerchantSlug,
      listingCategories: [existingPost.category, updatedPost.category].filter(
        (category): category is string => Boolean(category)
      ),
      postSlugs: [existingPost.slug, updatedPost.slug],
    });

    return NextResponse.json(
      discoverImageReadiness.ready
        ? updatedPost
        : { ...updatedPost, discoverImageReadiness }
    );
  } catch (error) {
    console.error('Blog post PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    // CSRF protection
    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(_request);
    if (!csrfValid) {
      return (
        csrfResponse ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const { id } = await params;
    const auth = await authenticateApiRequest(_request);
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

    const { data: existingPost, error: existingPostError } = await supabase
      .from('blog_posts')
      .select('slug, category')
      .eq('id', id)
      .eq('merchant_id', access.merchantId)
      .maybeSingle();

    if (existingPostError) {
      console.error(
        'Error fetching blog post before deletion:',
        existingPostError
      );
      return NextResponse.json(
        { error: 'Failed to load post for deletion' },
        { status: 500 }
      );
    }

    const blogRevalidation = await getMerchantBlogRevalidationContext(
      supabase,
      access.merchantId
    );

    // Delete post
    const { error: deleteError } = await supabase
      .from('blog_posts')
      .delete()
      .eq('id', id)
      .eq('merchant_id', access.merchantId);

    if (deleteError) {
      console.error('Error deleting blog post:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete post' },
        { status: 500 }
      );
    }

    // Invalidate blog caches after deletion
    revalidateBlogPosts({
      identifiers: blogRevalidation.identifiers,
      canonicalMerchantSlug: blogRevalidation.canonicalMerchantSlug,
      listingCategories: existingPost?.category ? [existingPost.category] : [],
      postSlugs: existingPost?.slug ? [existingPost.slug] : [],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Blog post DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

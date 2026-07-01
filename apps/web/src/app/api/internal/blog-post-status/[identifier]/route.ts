import { type NextRequest, NextResponse } from 'next/server';
import { getInternalApiSecret } from '@/env';
import { getCachedFeatureSettings, getMerchantSafe } from '@/lib/cached-data';
import { constantTimeEqual } from '@/lib/constant-time-equal';
import { applyPublicBlogSqlFilters } from '@/lib/public-blog-sql-filters';
import { toSafeInternalRedirectPath } from '@/lib/safe-internal-redirect-path';
import { createPublicClient } from '@/lib/supabase/anon';
import {
  internalBlogPostStatusQuerySchema,
  internalSlugSetParamsSchema,
} from '@/schemas/internal-slug-set-route';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;
const FAIL_OPEN = { hasError: true, present: false, redirectPath: null };
const MISSING = { hasError: false, present: false, redirectPath: null };
const PRESENT = { hasError: false, present: true, redirectPath: null };

interface BlogPostRedirectRow {
  target_post_id: string | null;
}

interface BlogPostTargetRow {
  slug: string | null;
}

function normalizeBlogSlug(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function buildRedirectBody(targetSlug: string) {
  const redirectPath = toSafeInternalRedirectPath(`/blog/${targetSlug}`);
  return redirectPath
    ? { hasError: false, present: true, redirectPath }
    : FAIL_OPEN;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ identifier: string }> }
): Promise<NextResponse> {
  const expectedSecret = getInternalApiSecret();
  if (!expectedSecret) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500, headers: NO_STORE }
    );
  }

  const authHeader = request.headers.get('Authorization');
  if (
    !authHeader ||
    !constantTimeEqual(authHeader, `Bearer ${expectedSecret}`)
  ) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: NO_STORE }
    );
  }

  const params = internalSlugSetParamsSchema.safeParse(await context.params);
  const query = internalBlogPostStatusQuerySchema.safeParse({
    slug: request.nextUrl.searchParams.get('slug'),
  });
  if (!params.success || !query.success) {
    return NextResponse.json(FAIL_OPEN, { status: 200, headers: NO_STORE });
  }

  try {
    const merchant = await getMerchantSafe(params.data.identifier);
    if (!merchant?.is_published) {
      return NextResponse.json(FAIL_OPEN, { status: 200, headers: NO_STORE });
    }

    const features = await getCachedFeatureSettings(merchant.id);
    if (!features?.blog_enabled) {
      return NextResponse.json(MISSING, { status: 200, headers: NO_STORE });
    }

    const sourceSlug = normalizeBlogSlug(query.data.slug);
    const supabase = createPublicClient({
      clientInfo: 'baci-web-internal-blog-post-status',
      timeoutMs: 5000,
    });

    let postQuery = supabase
      .from('blog_posts')
      .select('id, slug')
      .eq('merchant_id', merchant.id)
      .eq('slug', sourceSlug)
      .eq('status', 'published')
      .not('published_at', 'is', null)
      .not('title', 'is', null)
      .not('slug', 'is', null)
      .neq('title', '')
      .neq('slug', '');

    postQuery = applyPublicBlogSqlFilters(postQuery);

    const { data: post, error: postError } =
      await postQuery.maybeSingle<BlogPostTargetRow>();
    if (postError) {
      return NextResponse.json(FAIL_OPEN, { status: 200, headers: NO_STORE });
    }
    if (normalizeBlogSlug(post?.slug)) {
      return NextResponse.json(PRESENT, { status: 200, headers: NO_STORE });
    }

    const { data: redirectRow, error: redirectError } = await supabase
      .from('blog_post_redirects')
      .select('target_post_id')
      .eq('merchant_id', merchant.id)
      .eq('source_slug', sourceSlug)
      .maybeSingle<BlogPostRedirectRow>();
    if (redirectError) {
      return NextResponse.json(FAIL_OPEN, { status: 200, headers: NO_STORE });
    }

    const targetPostId = redirectRow?.target_post_id?.trim();
    if (!targetPostId) {
      return NextResponse.json(MISSING, { status: 200, headers: NO_STORE });
    }

    let targetPostQuery = supabase
      .from('blog_posts')
      .select('slug')
      .eq('merchant_id', merchant.id)
      .eq('id', targetPostId)
      .eq('status', 'published')
      .not('published_at', 'is', null)
      .not('title', 'is', null)
      .not('slug', 'is', null)
      .neq('title', '')
      .neq('slug', '');

    targetPostQuery = applyPublicBlogSqlFilters(targetPostQuery);

    const { data: targetPost, error: targetPostError } =
      await targetPostQuery.maybeSingle<BlogPostTargetRow>();
    if (targetPostError) {
      return NextResponse.json(FAIL_OPEN, { status: 200, headers: NO_STORE });
    }

    const targetSlug = normalizeBlogSlug(targetPost?.slug);
    if (!targetSlug || targetSlug === sourceSlug) {
      return NextResponse.json(MISSING, { status: 200, headers: NO_STORE });
    }

    return NextResponse.json(buildRedirectBody(targetSlug), {
      status: 200,
      headers: NO_STORE,
    });
  } catch {
    return NextResponse.json(FAIL_OPEN, { status: 200, headers: NO_STORE });
  }
}

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { invalidateCategoryCaches } from '@/lib/category-cache-invalidation';
import { checkCsrfProtection } from '@/lib/csrf';
import { createMerchantCategorySchema } from '@/schemas/create-merchant-category';
import { categoryMutationErrorResponse } from './category-mutation-error-response';
import {
  authenticateCategoryRequest,
  firstValidationMessage,
  resolveCategoryRouteContext,
} from './category-route-support';
import { validateCategoryParent } from './validate-category-parent';

/**
 * Create a category (B1-lite).
 *
 * The mutation runs on the caller's AUTHENTICATED client, so RLS
 * (`categories_merchant_insert`, owner-scoped) is the final authority — the
 * route's owner check is defence in depth, not the only gate. On success the
 * category surfaces are hard-expired at the origin before the active Vercel
 * HTML tags are deleted.
 */
export async function POST(request: NextRequest) {
  // Auth FIRST — before CSRF handling and before the body is read — so an
  // unauthenticated caller cannot probe validation behaviour or spend parsing
  // work. WHICH merchant is resolved later, once the body has been validated.
  const authentication = await authenticateCategoryRequest(request);
  if (!authentication.ok) {
    return authentication.response;
  }

  const { valid, response: csrfResponse } = await checkCsrfProtection(request);
  if (!valid) {
    return (
      csrfResponse ??
      NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Malformed JSON', code: 'MALFORMED_JSON' },
      { status: 400 }
    );
  }

  const parsed = createMerchantCategorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: firstValidationMessage(parsed.error),
        code: 'INVALID_INPUT',
        details: z.flattenError(parsed.error),
      },
      { status: 400 }
    );
  }

  // The asserted merchantId SELECTS among the merchants this caller already has
  // access to — it never grants any. An owner with several stores would
  // otherwise write to whichever one this server happens to default to.
  const resolution = await resolveCategoryRouteContext(
    authentication.auth,
    parsed.data.merchantId
  );
  if (!resolution.ok) {
    return resolution.response;
  }
  const { canonicalMerchantSlug, merchantId, supabase } = resolution.context;

  if (parsed.data.parentId) {
    const parentRefusal = await validateCategoryParent({
      supabase,
      merchantId,
      parentId: parsed.data.parentId,
    });
    if (parentRefusal) {
      return parentRefusal;
    }
  }

  const row = {
    merchant_id: merchantId,
    // Already sanitized by the schema, BEFORE its non-empty check — see
    // schemas/sanitized-category-text.ts for why the order matters.
    name: parsed.data.name,
    slug: parsed.data.slug,
    description: parsed.data.description || null,
    image_url: parsed.data.imageUrl ?? null,
    parent_id: parsed.data.parentId ?? null,
    display_order: parsed.data.displayOrder ?? 0,
    is_active: parsed.data.isActive ?? true,
  };

  let { data, error } = await supabase
    .from('categories')
    .insert(row)
    .select('id, name, slug, is_active')
    .single();

  // 23505 = unique violation (duplicate slug for this merchant). DELETE leaves
  // a deactivated tombstone rather than removing the row — see the handler's
  // comment for why — so the slug it occupies must remain re-creatable.
  // Reviving is scoped to explicit tombstones. Legacy NULL rows remain live:
  // the storefront slug-state function and cached reads normalize NULL to
  // active, so consuming one here would destructively replace a live category.
  if (error?.code === '23505') {
    const revived = await supabase
      .from('categories')
      // Reset EVERY merchant-authored field, not just those in `row`. The
      // tombstone's seo_heading/seo_description/seo_features/seo_faq are read
      // straight into the public category page by
      // getCachedCategoryPageShellData, so reusing a slug for a different
      // purpose would immediately republish the retired category's SEO copy.
      .update({
        ...row,
        seo_description: null,
        seo_faq: null,
        seo_features: null,
        seo_heading: null,
        metadata: { _baci_reused_tombstone: true },
        updated_at: new Date().toISOString(),
      })
      .eq('merchant_id', merchantId)
      .eq('slug', parsed.data.slug)
      .eq('is_active', false)
      .select('id, name, slug, is_active')
      .maybeSingle();

    // A failed revive lookup is not "no tombstone": falling through would
    // report a duplicate-slug 409 for a transient database error, telling the
    // client to stop retrying something that would have succeeded.
    if (revived.error)
      return categoryMutationErrorResponse(revived.error, 'create');
    if (revived.data) {
      data = revived.data;
      error = null;
    }
  }

  if (error) return categoryMutationErrorResponse(error, 'create');
  if (!data) {
    return NextResponse.json(
      { error: 'Category could not be created' },
      { status: 500 }
    );
  }

  const invalidation = await invalidateCategoryCaches({
    canonicalMerchantSlug,
    merchantId,
    nextSlug: data.slug,
    supabase,
  });

  return NextResponse.json(
    { category: data, cache: invalidation },
    { status: 201 }
  );
}

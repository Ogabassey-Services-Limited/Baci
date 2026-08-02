import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { invalidateCategoryCaches } from '@/lib/category-cache-invalidation';
import { checkCsrfProtection } from '@/lib/csrf';
import { logger } from '@/lib/logger';
import { categoryIdParamSchema } from '@/schemas/category-id-param';
import { categorySlugSchema } from '@/schemas/category-slug';
import { merchantIdParamSchema } from '@/schemas/merchant-id-param';
import { updateMerchantCategorySchema } from '@/schemas/update-merchant-category';
import { categoryMutationErrorResponse } from '../category-mutation-error-response';
import {
  authenticateCategoryRequest,
  firstValidationMessage,
  resolveCategoryRouteContext,
} from '../category-route-support';
import { buildCategoryUpdatePayload } from '../category-update-payload';
import { getCategoryChildSlugs } from '../get-category-child-slugs';
import { validateCategoryParent } from '../validate-category-parent';

interface RouteParams {
  params: Promise<{ categoryId: string }>;
}
/**
 * Rename / edit / deactivate a category (B1-lite).
 *
 * Captures the PRE-mutation slug so a rename invalidates the OLD category URL
 * too — otherwise the previous path keeps serving from cache after the route
 * stops existing. Deactivation (`isActive: false`) is a soft disable: the
 * public read policy (`is_active = true`) hides it without orphaning products.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  // Auth FIRST — before CSRF handling and before the body is read.
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

  const categoryId = categoryIdParamSchema.safeParse((await params).categoryId);
  if (!categoryId.success) {
    return NextResponse.json(
      { error: 'Invalid category id', code: 'INVALID_CATEGORY_ID' },
      { status: 400 }
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

  const parsed = updateMerchantCategorySchema.safeParse(body);
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

  // Selects among the merchants this caller already has access to — never
  // grants any. See resolveCategoryRouteContext for the multi-store rationale.
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
      categoryId: categoryId.data,
    });
    if (parentRefusal) {
      return parentRefusal;
    }
  }

  // Authoritative pre-mutation slug. Scoped by merchant_id as well as id so a
  // guessed id from another tenant reads as not-found rather than leaking.
  const { data: existing, error: readError } = await supabase
    .from('categories')
    .select('id, slug, is_active, updated_at')
    .eq('id', categoryId.data)
    .eq('merchant_id', merchantId)
    .maybeSingle();

  if (readError) {
    logger.error({
      message: 'Category lookup failed before update',
      merchantId,
      categoryId: categoryId.data,
      error: readError.message,
    });
    return NextResponse.json(
      { error: 'Could not load the category' },
      { status: 500 }
    );
  }
  if (!existing) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }
  const resultingIsActive = parsed.data.isActive ?? existing.is_active;
  if (resultingIsActive === true) {
    const resultingSlug = categorySlugSchema.safeParse(
      parsed.data.slug ?? existing.slug
    );
    if (!resultingSlug.success) {
      return NextResponse.json(
        {
          error: firstValidationMessage(resultingSlug.error),
          code: 'INVALID_INPUT',
          details: z.flattenError(resultingSlug.error),
        },
        { status: 400 }
      );
    }
  }

  const updates = buildCategoryUpdatePayload(
    parsed.data,
    new Date().toISOString()
  );
  const childSlugs =
    parsed.data.isActive === false
      ? await getCategoryChildSlugs(supabase, merchantId, categoryId.data)
      : { ok: true as const, slugs: [] };
  if (!childSlugs.ok) {
    return NextResponse.json(
      { error: 'Could not load child categories' },
      { status: 500 }
    );
  }

  let updateQuery = supabase
    .from('categories')
    .update(updates)
    .eq('id', categoryId.data)
    .eq('merchant_id', merchantId)
    .eq('slug', existing.slug);
  updateQuery =
    existing.updated_at === null
      ? updateQuery.is('updated_at', null)
      : updateQuery.eq('updated_at', existing.updated_at);

  const { data, error } = await updateQuery
    .select('id, name, slug, is_active')
    .maybeSingle();

  if (error) return categoryMutationErrorResponse(error, 'update');
  if (!data) {
    return NextResponse.json(
      {
        error: 'Category changed while it was being updated',
        code: 'CATEGORY_CONCURRENT_UPDATE',
      },
      { status: 409 }
    );
  }
  const invalidation = await invalidateCategoryCaches({
    canonicalMerchantSlug,
    merchantId,
    previousSlug: existing.slug,
    nextSlug: data.slug,
    relatedSlugs: childSlugs.slugs,
    supabase,
  });

  return NextResponse.json({
    category: data,
    ...(parsed.data.isActive === false && {
      detachedChildren: childSlugs.slugs.length,
      childrenDetached: true,
    }),
    cache: invalidation,
  });
}

/**
 * Retire a category (tombstone, NOT a hard delete).
 *
 * A hard delete REVIVES the URL. `getCachedCategoryPageShellData` falls back to
 * `{ kind: 'legacy', categoryName }` when no `categories` row matches the slug,
 * and that legacy scope matches products on the retained `products.category`
 * text with an ILIKE — so the "deleted" category page keeps serving its old
 * products and their canonical paths keep pointing at it. The same function
 * maps an INACTIVE row to `{ kind: 'none' }` (cached-data.ts), which is exactly
 * the empty state a deletion should produce.
 *
 * So the row is kept and deactivated. The slug therefore stays owned by this
 * merchant; POST revives a tombstone with the same slug rather than 409ing, so
 * "delete then re-create" still works.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

  const categoryId = categoryIdParamSchema.safeParse((await params).categoryId);
  if (!categoryId.success) {
    return NextResponse.json(
      { error: 'Invalid category id', code: 'INVALID_CATEGORY_ID' },
      { status: 400 }
    );
  }

  // DELETE carries no body, so the merchant assertion arrives as a query
  // parameter. Without it an owner with several stores could only ever delete
  // from whichever store this server defaults to; every other store 404s.
  const requestedMerchantId = request.nextUrl.searchParams.get('merchantId');
  if (requestedMerchantId !== null) {
    const merchantAssertion =
      merchantIdParamSchema.safeParse(requestedMerchantId);
    if (!merchantAssertion.success) {
      return NextResponse.json(
        { error: 'Invalid merchant id', code: 'INVALID_MERCHANT_ID' },
        { status: 400 }
      );
    }
  }
  const resolution = await resolveCategoryRouteContext(
    authentication.auth,
    requestedMerchantId ?? undefined
  );
  if (!resolution.ok) {
    return resolution.response;
  }
  const { canonicalMerchantSlug, merchantId, supabase } = resolution.context;

  const retiredAt = new Date().toISOString();
  const childSlugs = await getCategoryChildSlugs(
    supabase,
    merchantId,
    categoryId.data
  );
  if (!childSlugs.ok) {
    return NextResponse.json(
      { error: 'Could not load child categories' },
      { status: 500 }
    );
  }
  const { data: retired, error } = await supabase
    .from('categories')
    .update({ is_active: false, updated_at: retiredAt })
    .eq('id', categoryId.data)
    .eq('merchant_id', merchantId)
    .select('id, slug')
    .maybeSingle();

  if (error) {
    return categoryMutationErrorResponse(error, 'retire');
  }
  if (!retired) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  const invalidation = await invalidateCategoryCaches({
    canonicalMerchantSlug,
    merchantId,
    previousSlug: retired.slug,
    relatedSlugs: childSlugs.slugs,
    supabase,
  });

  return NextResponse.json({
    deleted: { id: retired.id },
    detachedChildren: childSlugs.slugs.length,
    childrenDetached: true,
    cache: invalidation,
  });
}

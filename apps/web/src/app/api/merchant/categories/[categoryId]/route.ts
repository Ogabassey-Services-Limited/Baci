import { type NextRequest, NextResponse } from 'next/server';
import { invalidateCategoryCaches } from '@/lib/category-cache-invalidation';
import { checkCsrfProtection } from '@/lib/csrf';
import { logger } from '@/lib/logger';
import { categoryIdParamSchema } from '@/schemas/category-id-param';
import { updateMerchantCategorySchema } from '@/schemas/update-merchant-category';
import {
  authenticateCategoryRequest,
  firstValidationMessage,
  isParentCategoryOwnedByMerchant,
  resolveCategoryRouteContext,
  wouldCreateCategoryCycle,
} from '../category-route-support';

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
        details: parsed.error.flatten(),
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
  const { merchantId, merchantIdentifiers, supabase } = resolution.context;

  if (parsed.data.parentId) {
    const parentOwnership = await isParentCategoryOwnedByMerchant(
      supabase,
      merchantId,
      parsed.data.parentId
    );
    // A failed lookup is NOT absence — a non-retryable 400 for a parent that
    // exists would be worse than an honest 500.
    if (parentOwnership === 'lookup-failed') {
      return NextResponse.json(
        { error: 'Could not verify the parent category' },
        { status: 500 }
      );
    }
    if (parentOwnership === 'absent') {
      return NextResponse.json(
        { error: 'Parent category not found', code: 'PARENT_NOT_FOUND' },
        { status: 400 }
      );
    }

    // Self-parenting is only the shortest cycle. Any ancestor loop detaches the
    // whole branch, because storefront navigation walks down from
    // `parent_id IS NULL` roots and a looped branch has none.
    const cycle = await wouldCreateCategoryCycle(
      supabase,
      merchantId,
      categoryId.data,
      parsed.data.parentId
    );
    if (cycle) {
      return NextResponse.json(
        {
          error: 'That parent would create a category loop',
          code: 'PARENT_CYCLE',
        },
        { status: 400 }
      );
    }
  }

  // Authoritative pre-mutation slug. Scoped by merchant_id as well as id so a
  // guessed id from another tenant reads as not-found rather than leaking.
  const { data: existing, error: readError } = await supabase
    .from('categories')
    .select('id, slug')
    .eq('id', categoryId.data)
    .eq('merchant_id', merchantId)
    .maybeSingle();

  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  // Already sanitized by the schema, before its non-empty check.
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.slug !== undefined) updates.slug = parsed.data.slug;
  if (parsed.data.description !== undefined)
    updates.description = parsed.data.description || null;
  if (parsed.data.imageUrl !== undefined)
    updates.image_url = parsed.data.imageUrl;
  if (parsed.data.parentId !== undefined)
    updates.parent_id = parsed.data.parentId;
  if (parsed.data.displayOrder !== undefined)
    updates.display_order = parsed.data.displayOrder;
  if (parsed.data.isActive !== undefined)
    updates.is_active = parsed.data.isActive;

  const { data, error } = await supabase
    .from('categories')
    .update(updates)
    .eq('id', categoryId.data)
    .eq('merchant_id', merchantId)
    .select('id, name, slug, is_active')
    .single();

  if (error) {
    const status = error.code === '23505' ? 409 : 500;
    return NextResponse.json(
      {
        error:
          status === 409
            ? 'A category with that slug already exists'
            : error.message,
        code: status === 409 ? 'CATEGORY_SLUG_TAKEN' : undefined,
      },
      { status }
    );
  }

  const invalidation = invalidateCategoryCaches({
    merchantId,
    merchantIdentifiers,
    previousSlug: existing.slug,
    nextSlug: data.slug,
  });

  return NextResponse.json({ category: data, cache: invalidation });
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

  // DELETE carries no body, so there is no merchant assertion to honour.
  const resolution = await resolveCategoryRouteContext(authentication.auth);
  if (!resolution.ok) {
    return resolution.response;
  }
  const { merchantId, merchantIdentifiers, supabase } = resolution.context;

  const retiredAt = new Date().toISOString();
  const { data: retired, error } = await supabase
    .from('categories')
    .update({ is_active: false, updated_at: retiredAt })
    .eq('id', categoryId.data)
    .eq('merchant_id', merchantId)
    .select('id, slug')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!retired) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  // Children would otherwise keep a non-null parent_id pointing at a retired
  // row: navigation walks DOWN from `parent_id IS NULL` roots, so they would
  // vanish from the storefront without ever being retired themselves — invisible
  // and unreachable. Promote them to roots so they stay browsable.
  const { data: orphaned, error: detachError } = await supabase
    .from('categories')
    .update({ parent_id: null, updated_at: retiredAt })
    .eq('merchant_id', merchantId)
    .eq('parent_id', categoryId.data)
    .select('slug');

  if (detachError) {
    // The parent is already retired at this point, so failing the response
    // would misreport a committed mutation. Report it instead.
    logger.error({
      message: 'Failed to detach children of a retired category',
      merchantId,
      categoryId: categoryId.data,
      error: detachError.message,
    });
  }

  const invalidation = invalidateCategoryCaches({
    merchantId,
    merchantIdentifiers,
    previousSlug: retired.slug,
  });

  return NextResponse.json({
    deleted: { id: retired.id },
    detachedChildren: orphaned?.length ?? 0,
    childrenDetached: !detachError,
    cache: invalidation,
  });
}

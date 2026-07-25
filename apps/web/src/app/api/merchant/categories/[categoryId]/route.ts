import { type NextRequest, NextResponse } from 'next/server';
import { invalidateCategoryCaches } from '@/lib/category-cache-invalidation';
import { checkCsrfProtection } from '@/lib/csrf';
import { categoryIdParamSchema } from '@/schemas/category-id-param';
import { merchantIdParamSchema } from '@/schemas/merchant-id-param';
import { updateMerchantCategorySchema } from '@/schemas/update-merchant-category';
import {
  authenticateCategoryRequest,
  firstValidationMessage,
  promoteChildrenToRoots,
  resolveCategoryRouteContext,
} from '../category-route-support';
import { buildCategoryUpdatePayload } from '../category-update-payload';
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
  const { merchantId, supabase } = resolution.context;

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

  const updates = buildCategoryUpdatePayload(
    parsed.data,
    new Date().toISOString()
  );

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

  // A PATCH that deactivates is a retirement, so it owes the same subtree
  // contract as DELETE: children of a deactivated parent would otherwise stay
  // active but drop out of root-based navigation.
  let detachedChildren: number | null = null;
  if (parsed.data.isActive === false) {
    detachedChildren = await promoteChildrenToRoots(
      supabase,
      merchantId,
      categoryId.data,
      String(updates.updated_at)
    );
  }

  const invalidation = invalidateCategoryCaches({
    merchantId,
    previousSlug: existing.slug,
    nextSlug: data.slug,
  });

  return NextResponse.json({
    category: data,
    ...(detachedChildren !== null && { detachedChildren }),
    childrenDetached:
      parsed.data.isActive === false ? detachedChildren !== null : undefined,
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
  const { merchantId, supabase } = resolution.context;

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

  const detachedChildren = await promoteChildrenToRoots(
    supabase,
    merchantId,
    categoryId.data,
    retiredAt
  );

  const invalidation = invalidateCategoryCaches({
    merchantId,
    previousSlug: retired.slug,
  });

  return NextResponse.json({
    deleted: { id: retired.id },
    detachedChildren: detachedChildren ?? 0,
    childrenDetached: detachedChildren !== null,
    cache: invalidation,
  });
}

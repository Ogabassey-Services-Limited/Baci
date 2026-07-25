import { type NextRequest, NextResponse } from 'next/server';
import { invalidateCategoryCaches } from '@/lib/category-cache-invalidation';
import { checkCsrfProtection } from '@/lib/csrf';
import { sanitizeText } from '@/lib/sanitize-core';
import { categoryIdParamSchema } from '@/schemas/category-id-param';
import { updateMerchantCategorySchema } from '@/schemas/update-merchant-category';
import {
  assertRequestedMerchant,
  firstValidationMessage,
  isParentCategoryOwnedByMerchant,
  resolveCategoryRouteContext,
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
  const resolution = await resolveCategoryRouteContext(request);
  if (!resolution.ok) {
    return resolution.response;
  }
  const { merchantId, merchantIdentifiers, supabase } = resolution.context;

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

  const mismatch = assertRequestedMerchant(
    resolution.context,
    parsed.data.merchantId
  );
  if (mismatch) {
    return mismatch;
  }

  if (parsed.data.parentId) {
    // Same-merchant parent, and never itself: a self-parent would make the
    // category its own ancestor and break every tree walk over the catalogue.
    if (parsed.data.parentId === categoryId.data) {
      return NextResponse.json(
        { error: 'A category cannot be its own parent', code: 'PARENT_SELF' },
        { status: 400 }
      );
    }
    const parentOwned = await isParentCategoryOwnedByMerchant(
      supabase,
      merchantId,
      parsed.data.parentId
    );
    if (!parentOwned) {
      return NextResponse.json(
        { error: 'Parent category not found', code: 'PARENT_NOT_FOUND' },
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
  if (parsed.data.name !== undefined)
    updates.name = sanitizeText(parsed.data.name, 160);
  if (parsed.data.slug !== undefined) updates.slug = parsed.data.slug;
  if (parsed.data.description !== undefined)
    updates.description = parsed.data.description
      ? sanitizeText(parsed.data.description, 2000)
      : null;
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

/** Delete a category, invalidating the removed slug. */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const resolution = await resolveCategoryRouteContext(request);
  if (!resolution.ok) {
    return resolution.response;
  }
  const { merchantId, merchantIdentifiers, supabase } = resolution.context;

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

  const { data: deleted, error } = await supabase
    .from('categories')
    .delete()
    .eq('id', categoryId.data)
    .eq('merchant_id', merchantId)
    .select('id, slug')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!deleted) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  const invalidation = invalidateCategoryCaches({
    merchantId,
    merchantIdentifiers,
    previousSlug: deleted.slug,
  });

  return NextResponse.json({
    deleted: { id: deleted.id },
    cache: invalidation,
  });
}

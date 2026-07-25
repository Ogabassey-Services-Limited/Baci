import { type NextRequest, NextResponse } from 'next/server';
import { invalidateCategoryCaches } from '@/lib/category-cache-invalidation';
import { checkCsrfProtection } from '@/lib/csrf';
import { sanitizeText } from '@/lib/sanitize-core';
import { createMerchantCategorySchema } from '@/schemas/create-merchant-category';
import {
  assertRequestedMerchant,
  firstValidationMessage,
  isParentCategoryOwnedByMerchant,
  resolveCategoryRouteContext,
} from './category-route-support';

/**
 * Create a category (B1-lite).
 *
 * The mutation runs on the caller's AUTHENTICATED client, so RLS
 * (`categories_merchant_insert`, owner-scoped) is the final authority — the
 * route's owner check is defence in depth, not the only gate. On success the
 * category surfaces are revalidated and an edge purge is scheduled.
 */
export async function POST(request: NextRequest) {
  // Auth FIRST — before CSRF handling and before the body is read — so an
  // unauthenticated caller cannot probe validation behaviour or spend parsing
  // work. Every subsequent step assumes an authenticated, owner-scoped caller.
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

  // A parent must belong to the SAME merchant: the FK only proves the UUID
  // exists somewhere in `categories`, so without this an owner could nest their
  // category under a foreign tenant's row.
  if (parsed.data.parentId) {
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

  const { data, error } = await supabase
    .from('categories')
    .insert({
      merchant_id: merchantId,
      // Merchant-authored text renders on the public storefront; mobile-admin
      // sanitized before its direct insert, so the API must not be the weaker
      // path now that it owns the write.
      name: sanitizeText(parsed.data.name, 160),
      slug: parsed.data.slug,
      description: parsed.data.description
        ? sanitizeText(parsed.data.description, 2000)
        : null,
      image_url: parsed.data.imageUrl ?? null,
      parent_id: parsed.data.parentId ?? null,
      display_order: parsed.data.displayOrder ?? 0,
      is_active: parsed.data.isActive ?? true,
    })
    .select('id, name, slug, is_active')
    .single();

  if (error) {
    // 23505 = unique violation (duplicate slug for this merchant).
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
    nextSlug: data.slug,
  });

  return NextResponse.json(
    { category: data, cache: invalidation },
    { status: 201 }
  );
}

import { type NextRequest, NextResponse } from 'next/server';
import { invalidateCategoryCaches } from '@/lib/category-cache-invalidation';
import { checkCsrfProtection } from '@/lib/csrf';
import { createMerchantCategorySchema } from '@/schemas/merchant-category';
import { resolveCategoryRouteContext } from './category-route-support';

/**
 * Create a category (B1-lite).
 *
 * The mutation runs on the caller's AUTHENTICATED client, so RLS
 * (`categories_merchant_insert`, owner-scoped) is the final authority — the
 * route's owner check is defence in depth, not the only gate. On success the
 * category surfaces are revalidated and a best-effort edge purge is attempted.
 */
export async function POST(request: NextRequest) {
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
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const resolution = await resolveCategoryRouteContext(
    request,
    parsed.data.merchantId
  );
  if (!resolution.ok) {
    return resolution.response;
  }
  const { merchantId, merchantIdentifiers, supabase } = resolution.context;

  const { data, error } = await supabase
    .from('categories')
    .insert({
      merchant_id: merchantId,
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description ?? null,
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

  const invalidation = await invalidateCategoryCaches({
    merchantId,
    merchantIdentifiers,
    nextSlug: data.slug,
  });

  return NextResponse.json(
    { category: data, cache: invalidation },
    {
      status: 201,
    }
  );
}

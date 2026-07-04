import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
} from '@/lib/api-auth';
import { revalidateProducts } from '@/lib/cache-revalidation';
import { checkCsrfProtection } from '@/lib/csrf';

const paramsSchema = z.object({
  id: z.uuid(),
});

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiRequest(request);
  if (auth.error || !auth.user || !auth.supabase) {
    return jsonError('Unauthorized', 401);
  }

  const csrf = await checkCsrfProtection(request);
  if (!csrf.valid) {
    return csrf.response ?? jsonError('CSRF validation failed', 403);
  }

  const access = await getUserAccess(auth.supabase);
  if (!access || !hasPermission(access, 'products', 'delete')) {
    return jsonError('Permission denied', 403);
  }

  const parsedParams = paramsSchema.safeParse(await context.params);
  if (!parsedParams.success) {
    return jsonError('Invalid product id', 400);
  }

  const { data: product, error } = await auth.supabase
    .from('products')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', parsedParams.data.id)
    .eq('merchant_id', access.merchantId)
    .select('id, slug, status')
    .single<{ id: string; slug: string | null; status: string }>();

  if (error) {
    if (error.code === 'PGRST116') {
      return jsonError('Product not found', 404);
    }

    return jsonError('Failed to delete product', 500);
  }

  revalidateProducts(access.merchantId, product.slug ?? undefined);

  return NextResponse.json({ product, success: true });
}

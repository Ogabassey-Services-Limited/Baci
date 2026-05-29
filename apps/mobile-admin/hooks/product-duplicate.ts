import { normalizeProductSearchText } from '@baci/shared';
import { fetchAdminProductSuggestionCandidates } from '@/lib/product-search';
import { supabase } from '@/lib/supabase';

export const DUPLICATE_PRODUCT_ERROR = 'A product with this name already exists.';

export function toProductSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function isDuplicateConstraintError(error: {
  code?: string;
  message: string;
}) {
  return (
    error.code === '23505' || error.message.toLowerCase().includes('duplicate')
  );
}

export async function assertNoDuplicateProduct(args: {
  merchantId: string;
  productName: string;
  excludeProductId?: string;
}) {
  const normalizedName = args.productName.trim();
  const normalizedSlug = toProductSlug(normalizedName);

  let nameQuery = supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('merchant_id', args.merchantId)
    .ilike('name', normalizedName);

  let slugQuery = supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('merchant_id', args.merchantId)
    .eq('slug', normalizedSlug);

  if (args.excludeProductId) {
    nameQuery = nameQuery.neq('id', args.excludeProductId);
    slugQuery = slugQuery.neq('id', args.excludeProductId);
  }

  const [
    { count: nameMatches, error: nameError },
    { count: slugMatches, error: slugError },
    similarProducts,
  ] = await Promise.all([
    nameQuery,
    slugQuery,
    fetchAdminProductSuggestionCandidates<{ id: string; name: string }>({
      excludeProductId: args.excludeProductId,
      limit: 5,
      merchantId: args.merchantId,
      productName: normalizedName,
      selectColumns: 'id, name',
    }),
  ]);

  if (nameError) throw new Error(nameError.message);
  if (slugError) throw new Error(slugError.message);

  if ((nameMatches ?? 0) > 0 || (slugMatches ?? 0) > 0) {
    throw new Error(DUPLICATE_PRODUCT_ERROR);
  }

  if (similarProducts.length > 0) {
    const normalizedSearchName = normalizeProductSearchText(normalizedName);
    const match = similarProducts.find((product) => {
      return normalizeProductSearchText(product.name) === normalizedSearchName;
    });
    if (match) {
      throw new Error(`A similar product "${match.name}" already exists.`);
    }
  }
}

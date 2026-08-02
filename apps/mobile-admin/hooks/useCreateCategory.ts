import { deriveCategorySlug, MAX_CATEGORY_NAME_LENGTH } from '@baci/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMerchant } from '@/hooks/useMerchant';
import { apiClient } from '@/lib/api-client';
import { sanitizeText } from '@/lib/sanitize';

/**
 * Create a storefront category.
 *
 * Extracted from `useProducts` to keep that module under the 300-line
 * guardrail; re-exported from there so existing importers and their module
 * mocks keep working.
 */
export function useCreateCategory() {
  const queryClient = useQueryClient();
  const { merchant } = useMerchant();

  return useMutation({
    mutationFn: async (name: string) => {
      if (!merchant?.id) throw new Error('No merchant');
      // Shared with createMerchantCategorySchema — 200 here meant a 161–200
      // character name passed locally and then 400'd at the API.
      const sanitizedName = sanitizeText(name, MAX_CATEGORY_NAME_LENGTH);
      if (!sanitizedName.trim()) throw new Error('Category name is required');
      // Shared with the route's schema. The old inline generator produced an
      // empty slug for a name with no ASCII characters (e.g. 手机) and had no
      // length bound, so the server rejected both with an unactionable 400.
      const slug = deriveCategorySlug(sanitizedName);
      if (!slug) {
        throw new Error(
          'Category name must contain letters or numbers we can use in its web address'
        );
      }

      // B1-lite: go through the web Route Handler instead of inserting
      // directly. A direct insert only invalidated React Query, so the
      // storefront's cached category surfaces kept serving stale data after a
      // merchant added a category. The handler owns origin cache revalidation.
      // `merchantId` is sent only as an
      // assertion the server 403s on if it disagrees with the session.
      const { category } = await apiClient<{
        category: { id: string; name: string; slug: string };
      }>('/api/merchant/categories', {
        method: 'POST',
        body: JSON.stringify({
          merchantId: merchant.id,
          name: sanitizedName,
          slug,
        }),
      });
      return category;
    },
    mutationKey: ['createCategory'],
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

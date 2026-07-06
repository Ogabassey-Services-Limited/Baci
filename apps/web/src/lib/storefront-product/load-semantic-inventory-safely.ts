import { getCachedProductSemanticInventory } from './get-cached-product-semantic-inventory';

interface LoadSemanticInventorySafelyInput {
  categorySlug: string;
  merchantId: string;
  warningMessage: string;
}

export async function loadSemanticInventorySafely({
  categorySlug,
  merchantId,
  warningMessage,
}: LoadSemanticInventorySafelyInput) {
  try {
    return await getCachedProductSemanticInventory(merchantId, categorySlug);
  } catch (error) {
    console.warn(warningMessage, {
      categorySlug,
      merchantId,
      error,
    });

    return [];
  }
}

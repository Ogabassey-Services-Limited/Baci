import type { ProductFormValues } from '@/lib/validators/product';

export interface UpdateProductVariables {
  id: string;
  updates: ProductFormValues;
  /**
   * The product's PRE-SAVE category text / id, captured from the loaded product
   * in the edit controller. On a category MOVE these seed a hint-only purge of
   * the OLD category's cached storefront URLs.
   */
  previousCategory?: string | null;
  previousCategoryId?: string | null;
}

export interface UpdateProductArgs extends UpdateProductVariables {
  merchantId: string;
}

/**
 * Assemble the `updateProductRecord` args from the mutation variables plus the
 * resolved merchant id. Kept as a standalone helper so the mutation hook stays
 * within the module-size budget and the payload assembly is unit-testable.
 */
export function buildUpdateProductArgs(
  merchantId: string,
  variables: UpdateProductVariables
): UpdateProductArgs {
  return {
    id: variables.id,
    merchantId,
    updates: variables.updates,
    previousCategory: variables.previousCategory,
    previousCategoryId: variables.previousCategoryId,
  };
}

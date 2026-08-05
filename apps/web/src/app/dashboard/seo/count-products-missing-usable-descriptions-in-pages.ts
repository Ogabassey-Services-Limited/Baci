type ProductDescriptionPage = {
  data: ReadonlyArray<{ description: string | null }> | null;
  error: { message: string } | null;
};

const PRODUCT_DESCRIPTION_PAGE_SIZE = 250;

export async function countProductsMissingUsableDescriptionsInPages(
  loadPage: (range: {
    from: number;
    to: number;
  }) => PromiseLike<ProductDescriptionPage>
): Promise<number> {
  let missingDescriptionCount = 0;

  for (let from = 0; ; from += PRODUCT_DESCRIPTION_PAGE_SIZE) {
    const { data, error } = await loadPage({
      from,
      to: from + PRODUCT_DESCRIPTION_PAGE_SIZE - 1,
    });
    if (error) throw new Error(error.message);

    const products = data ?? [];
    missingDescriptionCount += products.filter(
      (product) => !product.description?.trim()
    ).length;
    if (products.length < PRODUCT_DESCRIPTION_PAGE_SIZE) {
      return missingDescriptionCount;
    }
  }
}

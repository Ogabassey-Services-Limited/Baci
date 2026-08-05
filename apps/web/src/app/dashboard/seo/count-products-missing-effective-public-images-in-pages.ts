import { countProductsMissingEffectivePublicImages } from './count-products-missing-effective-public-images';

type ProductImageSource = Parameters<
  typeof countProductsMissingEffectivePublicImages
>[0][number];

type ProductImageSourcePage = {
  data: readonly ProductImageSource[] | null;
  error: { message: string } | null;
};

const PRODUCT_IMAGE_SOURCE_PAGE_SIZE = 250;

export async function countProductsMissingEffectivePublicImagesInPages(
  loadPage: (range: {
    from: number;
    to: number;
  }) => PromiseLike<ProductImageSourcePage>
): Promise<number> {
  let missingImageCount = 0;

  for (let from = 0; ; from += PRODUCT_IMAGE_SOURCE_PAGE_SIZE) {
    const { data, error } = await loadPage({
      from,
      to: from + PRODUCT_IMAGE_SOURCE_PAGE_SIZE - 1,
    });
    if (error) throw new Error(error.message);

    const products = data ?? [];
    missingImageCount += countProductsMissingEffectivePublicImages(products);
    if (products.length < PRODUCT_IMAGE_SOURCE_PAGE_SIZE) {
      return missingImageCount;
    }
  }
}

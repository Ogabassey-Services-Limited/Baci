import { StorefrontLinkModulesSection } from '@/components/storefront/ogabassey/seo/storefront-link-modules-section';
import {
  loadProductsPageLinkModules,
  type ProductsPageLinkModuleCategory,
} from './products-page-link-modules';

interface ProductsPageDeferredLinkModulesProps {
  baseUrl: string;
  categories: ProductsPageLinkModuleCategory[];
  merchantId: string;
  pathPrefix: string;
  productTotalPages: number;
}

export async function ProductsPageDeferredLinkModules({
  baseUrl,
  categories,
  merchantId,
  pathPrefix,
  productTotalPages,
}: ProductsPageDeferredLinkModulesProps) {
  const modules = await loadProductsPageLinkModules({
    baseUrl,
    categories,
    merchantId,
    productTotalPages,
  });

  return (
    <StorefrontLinkModulesSection modules={modules} pathPrefix={pathPrefix} />
  );
}

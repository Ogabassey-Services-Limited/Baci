import { brandAuthorityPageLoader } from '@/lib/storefront-category/load-brand-authority-page';
import { modelFamilyAuthorityTaxonomy } from '@/lib/storefront-category/model-family-authority-taxonomy';
import { getCountryShoppingContext } from '@/lib/storefront-localization';
import { buildStorefrontMetadataTitle } from '@/lib/storefront-metadata-title';

async function loadModelFamilyAuthorityPage(args: {
  merchantSlug: string;
  categorySlug: string;
  brandSlug: string;
  familySlug: string;
}) {
  const family = modelFamilyAuthorityTaxonomy.getEntry(
    args.categorySlug,
    args.brandSlug,
    args.familySlug
  );
  if (!family) return null;

  const brandPage = await brandAuthorityPageLoader.load(
    {
      merchantSlug: args.merchantSlug,
      categorySlug: args.categorySlug,
      brandSlug: args.brandSlug,
    },
    { includeRequestPathPrefix: false }
  );
  if (!brandPage) return null;

  const products = brandPage.products.filter((product) =>
    modelFamilyAuthorityTaxonomy.matchesProduct(family, product.name)
  );
  if (products.length < family.minimumProducts) return null;

  const canonicalUrl = `${brandPage.canonicalUrl}/families/${family.familyKey}`;
  const countryContext = getCountryShoppingContext(brandPage.merchant.country);
  const countrySuffix = countryContext ? ` ${countryContext}` : '';
  const heading = `${family.displayName} Phones and Prices${countrySuffix}`;

  return {
    ...brandPage,
    canonicalUrl,
    heading,
    intro: `Compare ${products.length} available ${family.displayName} phones from ${brandPage.merchant.business_name}, including current prices, specifications, condition, and availability.`,
    metaTitle: buildStorefrontMetadataTitle({
      title: heading,
      suffix: brandPage.merchant.business_name,
      fallback: family.displayName,
    }).title,
    metaDescription: `Compare ${products.length} ${family.displayName} phones from ${brandPage.merchant.business_name}, with current prices, specifications, condition, and availability${countrySuffix}.`,
    products,
    brand: { ...brandPage.brand, displayName: family.displayName },
    familyLinks: [],
    breadcrumbItems: [
      ...brandPage.breadcrumbItems,
      { name: family.displayName, url: canonicalUrl },
    ],
  };
}

export const modelFamilyAuthorityPageLoader = {
  load: loadModelFamilyAuthorityPage,
};

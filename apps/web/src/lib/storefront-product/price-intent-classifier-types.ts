export type PriceIntentAssetKind =
  | 'pdp'
  | 'price-hub'
  | 'no-catalog'
  | 'ignore';

export interface PriceIntentCatalogProduct {
  slug: string;
  name: string;
  brand?: string | null;
  categorySlug?: string | null;
  condition?: string | null;
  productKeySpecs?: Record<string, unknown> | null;
}

export interface PreparedPriceIntentCatalogProduct {
  brandTokens: string[];
  coreTokens: string[];
  product: PriceIntentCatalogProduct;
  tokenSet: Set<string>;
}

interface BaseClassifyPriceIntentKeywordInput {
  keyword: string;
  marketPhrase?: string | null;
  minHubProducts?: number;
}

export type ClassifyPriceIntentKeywordInput =
  | (BaseClassifyPriceIntentKeywordInput & {
      catalog: PriceIntentCatalogProduct[];
      preparedCatalog?: PreparedPriceIntentCatalogProduct[];
    })
  | (BaseClassifyPriceIntentKeywordInput & {
      catalog?: PriceIntentCatalogProduct[];
      preparedCatalog: PreparedPriceIntentCatalogProduct[];
    });

export interface PriceIntentClassification {
  assetKind: PriceIntentAssetKind;
  reason: string;
  keyword: string;
  categorySlug?: string;
  targetSlug?: string;
  nearestProductSlug?: string;
  hubSlug?: string;
  matchedProductSlugs?: string[];
  modifiers: string[];
}

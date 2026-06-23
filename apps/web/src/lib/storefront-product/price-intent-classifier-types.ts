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

export interface PreparedPriceIntentCatalog {
  brandTokenSet: Set<string>;
  entries: PreparedPriceIntentCatalogProduct[];
  tokenCounts: Map<string, number>;
}

interface BaseClassifyPriceIntentKeywordInput {
  keyword: string;
  marketPhrase?: string | null;
  minHubProducts?: number;
}

export type ClassifyPriceIntentKeywordInput =
  | (BaseClassifyPriceIntentKeywordInput & {
      catalog: PriceIntentCatalogProduct[];
      preparedCatalog?: PreparedPriceIntentCatalog;
    })
  | (BaseClassifyPriceIntentKeywordInput & {
      catalog?: PriceIntentCatalogProduct[];
      preparedCatalog: PreparedPriceIntentCatalog;
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

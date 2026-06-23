export type PriceIntentAssetKind =
  | 'pdp'
  | 'price-hub'
  | 'no-catalog'
  | 'ignore';

export type PriceIntentClassificationReason =
  | 'not_price_intent'
  | 'exact_product'
  | 'exact_product_with_modifiers'
  | 'modifier_not_supported_by_catalog'
  | 'broad_cluster_price_intent'
  | 'no_matching_catalog_entity';

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
  reason: PriceIntentClassificationReason;
  keyword: string;
  categorySlug?: string;
  targetSlug?: string;
  nearestProductSlug?: string;
  hubSlug?: string;
  matchedProductSlugs?: string[];
  modifiers: string[];
}

export type ClusterSupport = {
  categoryNames: readonly string[];
  articleTokens: readonly string[];
  brandTokens: Record<string, readonly string[]>;
  priceBandAliases: Record<string, readonly string[]>;
};

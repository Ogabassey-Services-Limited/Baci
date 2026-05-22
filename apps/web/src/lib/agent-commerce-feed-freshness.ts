interface AgentCommerceFreshnessProduct {
  updated_at?: string | null;
}

interface CurrentProductCoverageInput {
  staleProducts: number;
  totalProducts: number;
}

interface CountStaleProductsInput {
  now: Date;
  products: AgentCommerceFreshnessProduct[];
}

/**
 * Shared configuration and helpers for agent commerce feed freshness checks.
 * minCurrentProductRatio is the minimum current-product fraction required to
 * mark a feed healthy, and warningWindowDays is the timestamp lookback window.
 */
export const AGENT_COMMERCE_FEED_FRESHNESS = {
  minCurrentProductRatio: 0.98,
  warningWindowDays: 30,

  countStaleProducts({ now, products }: CountStaleProductsInput): number {
    const cutoff =
      now.getTime() -
      AGENT_COMMERCE_FEED_FRESHNESS.warningWindowDays * 24 * 60 * 60 * 1000;

    return products.filter((product) => {
      if (!product.updated_at) return true;
      const updatedAt = Date.parse(product.updated_at);
      return !Number.isFinite(updatedAt) || updatedAt < cutoff;
    }).length;
  },

  countProductsMissingTimestamps(
    products: AgentCommerceFreshnessProduct[]
  ): number {
    return products.filter((product) => {
      if (!product.updated_at) return true;
      return !Number.isFinite(Date.parse(product.updated_at));
    }).length;
  },

  hasCurrentProductCoverage({
    staleProducts,
    totalProducts,
  }: CurrentProductCoverageInput): boolean {
    if (totalProducts === 0) return false;

    return (
      (totalProducts - staleProducts) / totalProducts >=
      AGENT_COMMERCE_FEED_FRESHNESS.minCurrentProductRatio
    );
  },
};

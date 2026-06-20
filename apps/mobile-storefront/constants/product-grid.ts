export const PRODUCT_GRID_MAX_PRICE_LIMIT = 3_000_000;
export const PRODUCT_GRID_LOADING_MORE_LABEL = 'Loading more products';

/**
 * Minimum number of post-client-filter products to keep realized before the
 * FlashList feed proactively requests another page. Client-side category
 * filtering can thin a plentiful raw page below a viewport, so the home feed
 * backfills until this floor is met or the catalog is exhausted.
 */
export const PRODUCT_GRID_BACKFILL_FLOOR = 6;

export interface AdPlacement {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  mobileWidth: number;
  mobileHeight: number;
  type: 'banner' | 'sidebar' | 'in-feed' | 'sticky';
}

export const AD_CONFIG: Record<string, AdPlacement> = {
  // 1. HEADER LEADERBOARD (Standard)
  // Location: Top of pages, or inside the top Banner Carousel.
  // Standard: 728x90 (Desktop) | 320x100 (Mobile)
  HEADER_LEADERBOARD: {
    id: 'div-gpt-ad-header',
    name: 'Header Leaderboard',
    description: 'High visibility top-of-page banner.',
    width: 728,
    height: 90,
    mobileWidth: 320,
    mobileHeight: 100,
    type: 'banner'
  },

  // 2. HOMEPAGE STRIP (High Impact)
  // Location: Between Hero and Product Filters on Home.
  // Standard: 970x90 (Desktop) | 320x50 (Mobile)
  HOMEPAGE_STRIP: {
    id: 'div-gpt-ad-home-strip',
    name: 'Homepage Large Strip',
    description: 'Wide banner separating hero content from products.',
    width: 970,
    height: 90,
    mobileWidth: 320,
    mobileHeight: 50,
    type: 'banner'
  },

  // 3. PRODUCT SIDEBAR (Half Page - High CPM)
  // Location: Product Details Sidebar.
  // Standard: 300x600 (Desktop) | Hidden or 300x250 (Mobile)
  // Note: 300x600 is one of the fastest growing sizes by impression.
  SIDEBAR_HALF_PAGE: {
    id: 'div-gpt-ad-sidebar-large',
    name: 'Sidebar Half Page',
    description: 'Large vertical ad for product detail sidebars.',
    width: 300,
    height: 600,
    mobileWidth: 300,
    mobileHeight: 250,
    type: 'sidebar'
  },

  // 4. PRODUCT GRID (Medium Rectangle)
  // Location: Inside product lists (every 8 items).
  // Standard: 300x250 (Desktop & Mobile)
  // Note: The "MPU" (Mid-Page Unit) is the most compatible ad size.
  PRODUCT_GRID_MPU: {
    id: 'div-gpt-ad-grid-mpu',
    name: 'In-Feed MPU',
    description: 'Square ad inserted naturally into product grids.',
    width: 300,
    height: 250,
    mobileWidth: 300,
    mobileHeight: 250,
    type: 'in-feed'
  },

  // 5. CONTENT BREAK (Leaderboard)
  // Location: Between Product Description and Reviews.
  // Standard: 728x90 (Desktop) | 320x50 (Mobile)
  CONTENT_BREAK: {
    id: 'div-gpt-ad-content',
    name: 'Content Section Break',
    description: 'Horizontal divider before deep content areas.',
    width: 728,
    height: 90,
    mobileWidth: 320,
    mobileHeight: 50,
    type: 'banner'
  },

  // 6. CART SIDEBAR (Medium Rectangle)
  // Location: Bottom of Cart Drawer.
  // Standard: 300x250
  CART_MPU: {
    id: 'div-gpt-ad-cart',
    name: 'Cart Drawer MPU',
    description: 'Square ad visible during checkout flow.',
    width: 300,
    height: 250,
    mobileWidth: 300,
    mobileHeight: 250,
    type: 'sidebar'
  },

  // 7. FOOTER (Billboard/Leaderboard)
  // Location: Just above footer.
  // Standard: 970x250 (Billboard) or 728x90
  FOOTER_BANNER: {
    id: 'div-gpt-ad-footer',
    name: 'Footer Banner',
    description: 'Large footer placement for ending the user journey.',
    width: 970,
    height: 250,
    mobileWidth: 320,
    mobileHeight: 100,
    type: 'banner'
  }
};
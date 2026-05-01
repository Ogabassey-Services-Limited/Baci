export const DEFAULT_PAGE_SPEED_ROUTES = [
  { label: 'home', path: '/' },
  { label: 'pricing', path: '/pricing' },
  { label: 'features', path: '/features' },
  { label: 'blog', path: '/blog' },
  { label: 'contact', path: '/contact' },
] as const;

// Performance floor matches current production PSI (mobile + desktop both 0.87)
// so the nightly seo-monitoring workflow does not page on-call from day one.
// Ratchet up to 0.9 after the LCP/CLS optimisation follow-up lands.
export const CATEGORY_THRESHOLDS = {
  performance: 0.87,
  accessibility: 0.9,
  seo: 0.9,
  'best-practices': 0.9,
} as const;

export const AUDIT_THRESHOLDS = {
  lcp: 2500,
  cls: 0.1,
  tbt: 200,
  inp: 200,
} as const;

export const EMPTY_PAGE_SPEED_SCORES = {
  performance: null,
  accessibility: null,
  seo: null,
  'best-practices': null,
} as const;

export const EMPTY_PAGE_SPEED_VITALS = {
  lcp: null,
  cls: null,
  tbt: null,
  inp: null,
} as const;

export const PAGE_SPEED_TIMEOUT_MS = 45_000;

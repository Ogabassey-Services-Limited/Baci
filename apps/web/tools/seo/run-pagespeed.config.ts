export const DEFAULT_PAGE_SPEED_ROUTES = [
  { label: 'home', path: '/' },
  { label: 'pricing', path: '/pricing' },
  { label: 'features', path: '/features' },
  { label: 'blog', path: '/blog' },
  { label: 'contact', path: '/contact' },
] as const;

export const CATEGORY_THRESHOLDS = {
  performance: 0.8,
  accessibility: 0.9,
  seo: 0.9,
  'best-practices': 0.85,
} as const;

export const AUDIT_THRESHOLDS = {
  lcp: 2500,
  cls: 0.1,
  tbt: 200,
  inp: 200,
} as const;

export const PAGE_SPEED_TIMEOUT_MS = 45_000;

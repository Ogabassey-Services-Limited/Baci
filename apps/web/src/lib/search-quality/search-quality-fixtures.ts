import type { CanonicalProductCondition } from '@baci/shared/lib';

export type SearchQualityFixtureKind =
  | 'exact'
  | 'typo'
  | 'spec'
  | 'condition'
  | 'price-intent'
  | 'locale'
  | 'agentic-parity'
  | 'zero-results';

export interface SearchQualityFixture {
  expectedParsedFilters?: {
    condition?: CanonicalProductCondition;
    maxPrice?: number;
    minPrice?: number;
    storageGb?: number;
  };
  expectedTopProductNames: string[];
  kind: SearchQualityFixtureKind;
  query: string;
}

export const SEARCH_QUALITY_FIXTURES: SearchQualityFixture[] = [
  {
    kind: 'exact',
    query: 'iphone',
    expectedTopProductNames: ['iPhone'],
  },
  {
    kind: 'exact',
    query: 'iphone 16 pro max',
    expectedTopProductNames: ['iPhone 16 Pro Max'],
  },
  {
    kind: 'exact',
    query: 'samsung s24',
    expectedTopProductNames: ['Samsung'],
  },
  {
    kind: 'typo',
    query: 'iphnoe',
    expectedTopProductNames: ['iPhone'],
  },
  {
    kind: 'typo',
    query: 'ipone',
    expectedTopProductNames: ['iPhone'],
  },
  {
    kind: 'typo',
    query: 'samung',
    expectedTopProductNames: ['Samsung'],
  },
  {
    kind: 'spec',
    query: '256gb iphone',
    expectedParsedFilters: { storageGb: 256 },
    expectedTopProductNames: ['iPhone'],
  },
  {
    kind: 'spec',
    query: 'dual sim iphone',
    expectedTopProductNames: ['iPhone'],
  },
  {
    kind: 'spec',
    query: 'esim iphone',
    expectedTopProductNames: ['iPhone'],
  },
  {
    kind: 'condition',
    query: 'used iphone',
    expectedParsedFilters: { condition: 'used' },
    expectedTopProductNames: ['iPhone'],
  },
  {
    kind: 'condition',
    query: 'refurbished iphone',
    expectedParsedFilters: { condition: 'open_box' },
    expectedTopProductNames: ['iPhone'],
  },
  {
    kind: 'condition',
    query: 'open box laptop',
    expectedParsedFilters: { condition: 'open_box' },
    expectedTopProductNames: ['Laptop'],
  },
  {
    kind: 'price-intent',
    query: 'phone under 500k',
    expectedParsedFilters: { maxPrice: 500000 },
    expectedTopProductNames: ['iPhone', 'Samsung'],
  },
  {
    kind: 'price-intent',
    query: 'laptop below 2m',
    expectedParsedFilters: { maxPrice: 2000000 },
    expectedTopProductNames: ['MacBook', 'Laptop'],
  },
  {
    kind: 'locale',
    query: 'iphóné',
    expectedTopProductNames: ['iPhone'],
  },
  {
    kind: 'locale',
    query: 'ṣamṣung',
    expectedTopProductNames: ['Samsung'],
  },
  {
    kind: 'agentic-parity',
    query: 'iphone 16 pro',
    expectedTopProductNames: ['iPhone 16 Pro'],
  },
  {
    kind: 'zero-results',
    query: 'nonexistent quantum gadget',
    expectedTopProductNames: [],
  },
];

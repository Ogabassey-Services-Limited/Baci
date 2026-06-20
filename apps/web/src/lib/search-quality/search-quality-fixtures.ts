import type { CanonicalProductCondition } from '@baci/shared/lib';
import { z } from 'zod';
import searchQualityFixtureData from './search-quality-fixtures.json';

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

const searchQualityFixtureSchema = z.object({
  expectedParsedFilters: z
    .object({
      condition: z.enum(['new', 'open_box', 'used']).optional(),
      maxPrice: z.number().int().positive().optional(),
      minPrice: z.number().int().positive().optional(),
      storageGb: z.number().int().positive().optional(),
    })
    .optional(),
  expectedTopProductNames: z.array(z.string()),
  kind: z.enum([
    'exact',
    'typo',
    'spec',
    'condition',
    'price-intent',
    'locale',
    'agentic-parity',
    'zero-results',
  ]),
  query: z.string(),
}) satisfies z.ZodType<SearchQualityFixture>;

export function parseSearchQualityFixtures(
  fixtures: unknown
): SearchQualityFixture[] {
  return z.array(searchQualityFixtureSchema).parse(fixtures);
}

export const SEARCH_QUALITY_FIXTURES: SearchQualityFixture[] =
  parseSearchQualityFixtures(searchQualityFixtureData);

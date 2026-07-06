import { describe, expect, it } from 'vitest';
import {
  dedupePathSegmentsPreservingCasing,
  resolvePurgeHostnames,
} from './storefront-purge-shared';

describe('resolvePurgeHostnames', () => {
  it('resolves a known merchant slug to its custom hostname fan-out', () => {
    expect(resolvePurgeHostnames('ogabassey')).toEqual([
      'ogabassey.com',
      'www.ogabassey.com',
    ]);
  });

  it('resolves the same policy when the identifier is one of its custom hostnames', () => {
    expect(resolvePurgeHostnames('ogabassey.com')).toEqual([
      'ogabassey.com',
      'www.ogabassey.com',
    ]);
  });

  it('matches case-insensitively', () => {
    expect(resolvePurgeHostnames('OgaBassey')).toEqual([
      'ogabassey.com',
      'www.ogabassey.com',
    ]);
  });

  it('returns an empty list for a storefront without a public cache policy', () => {
    expect(resolvePurgeHostnames('unknown-store')).toEqual([]);
  });

  it('returns an empty list for a blank identifier', () => {
    expect(resolvePurgeHostnames('   ')).toEqual([]);
  });
});

describe('dedupePathSegmentsPreservingCasing', () => {
  it('drops blank segments and exact duplicates', () => {
    expect(
      dedupePathSegmentsPreservingCasing(['post-a', '  ', 'post-a'])
    ).toEqual(['post-a']);
  });

  it('keeps case-only-distinct segments (CDN cache keys are case-sensitive)', () => {
    // A case-only rename means the old and new URLs are two distinct cached
    // entries, so both must be purged — this is NOT collapsed as a duplicate.
    expect(
      dedupePathSegmentsPreservingCasing([
        'iphone-15',
        'IPHONE-15',
        'iphone-15',
      ])
    ).toEqual(['iphone-15', 'IPHONE-15']);
  });

  it('trims surrounding whitespace before deduping', () => {
    expect(dedupePathSegmentsPreservingCasing([' post-a ', 'post-a'])).toEqual([
      'post-a',
    ]);
  });
});

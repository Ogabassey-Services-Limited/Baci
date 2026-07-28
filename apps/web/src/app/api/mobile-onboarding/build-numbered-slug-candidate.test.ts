import { describe, expect, it } from 'vitest';
import { buildNumberedSlugCandidate } from './build-numbered-slug-candidate';

describe('buildNumberedSlugCandidate', () => {
  it('adds a stable numeric suffix to the auto-generated slug', () => {
    expect(buildNumberedSlugCandidate('test', 1)).toBe('test-1');
  });

  it('keeps the resulting storefront subdomain within the DNS label limit', () => {
    const candidate = buildNumberedSlugCandidate('a'.repeat(63), 12);

    expect(candidate).toHaveLength(63);
    expect(candidate.endsWith('-12')).toBe(true);
  });
});

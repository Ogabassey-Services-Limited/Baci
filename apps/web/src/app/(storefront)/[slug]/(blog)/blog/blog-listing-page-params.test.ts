import { describe, expect, it } from 'vitest';
import { parseBlogListingPage } from './blog-listing-page-params';

describe('parseBlogListingPage', () => {
  it('defaults missing, invalid, and sub-one page values to the first page', () => {
    expect(parseBlogListingPage()).toBe(1);
    expect(parseBlogListingPage('not-a-page')).toBe(1);
    expect(parseBlogListingPage('0')).toBe(1);
    expect(parseBlogListingPage('-4')).toBe(1);
  });

  it('parses positive page strings for metadata and runtime routes', () => {
    expect(parseBlogListingPage('3')).toBe(3);
    expect(parseBlogListingPage('12')).toBe(12);
  });

  it('caps very large / malformed page values before the fetch', () => {
    // Avoids unbounded cache keys + absurd Supabase range offsets.
    expect(parseBlogListingPage('999999999999999999999')).toBe(10_000);
    expect(parseBlogListingPage('50001')).toBe(10_000);
    // parseInt is lenient, so partially-numeric values still parse their prefix.
    expect(parseBlogListingPage('2abc')).toBe(2);
  });
});

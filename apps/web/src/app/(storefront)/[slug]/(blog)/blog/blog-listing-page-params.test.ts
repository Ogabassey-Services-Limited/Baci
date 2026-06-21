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
});

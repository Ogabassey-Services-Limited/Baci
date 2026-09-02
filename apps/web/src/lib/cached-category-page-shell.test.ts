import { describe, expect, it } from 'vitest';
import {
  getCategoryFallbackName,
  isPostgrestNoRowsError,
} from './cached-category-page-shell';

describe('cached category page shell helpers', () => {
  it('keeps fallback names deterministic for encoded category slugs', () => {
    expect(getCategoryFallbackName('phones%2Dand%2Dtablets')).toBe(
      'Phones And Tablets'
    );
  });

  it('recognizes only PostgREST no-row errors as an expected absence', () => {
    expect(isPostgrestNoRowsError({ code: 'PGRST116' })).toBe(true);
    expect(isPostgrestNoRowsError({ code: '57014' })).toBe(false);
    expect(isPostgrestNoRowsError(null)).toBe(false);
  });
});

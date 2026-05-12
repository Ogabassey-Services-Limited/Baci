import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./use-merchant-client', () => ({
  useMerchantSafe: vi.fn(() => ({ merchant: { id: 'merchant-1' } })),
}));

import { getRecentlyViewedIds, useRecentlyViewed } from './use-recently-viewed';

describe('useRecentlyViewed', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts with empty list', () => {
    const { result } = renderHook(() => useRecentlyViewed());
    expect(result.current.recentlyViewedIds).toEqual([]);
    expect(result.current.count).toBe(0);
  });

  it('adds product to recently viewed', () => {
    const { result } = renderHook(() => useRecentlyViewed());
    act(() => result.current.addToRecentlyViewed('prod-1'));
    expect(result.current.recentlyViewedIds).toContain('prod-1');
    expect(result.current.count).toBe(1);
  });

  it('most recent product appears first', () => {
    const { result } = renderHook(() => useRecentlyViewed());
    act(() => result.current.addToRecentlyViewed('prod-1'));
    act(() => result.current.addToRecentlyViewed('prod-2'));
    expect(result.current.recentlyViewedIds[0]).toBe('prod-2');
  });

  it('deduplicates product entries', () => {
    const { result } = renderHook(() => useRecentlyViewed());
    act(() => result.current.addToRecentlyViewed('prod-1'));
    act(() => result.current.addToRecentlyViewed('prod-2'));
    act(() => result.current.addToRecentlyViewed('prod-1'));
    expect(result.current.count).toBe(2);
    expect(result.current.recentlyViewedIds[0]).toBe('prod-1');
  });

  it('excludes specified product', () => {
    const { result } = renderHook(() =>
      useRecentlyViewed({ excludeProductId: 'prod-1' })
    );
    act(() => result.current.addToRecentlyViewed('prod-1'));
    act(() => result.current.addToRecentlyViewed('prod-2'));
    expect(result.current.recentlyViewedIds).not.toContain('prod-1');
    expect(result.current.recentlyViewedIds).toContain('prod-2');
  });

  it('respects maxItems limit', () => {
    const { result } = renderHook(() => useRecentlyViewed({ maxItems: 2 }));
    act(() => result.current.addToRecentlyViewed('prod-1'));
    act(() => result.current.addToRecentlyViewed('prod-2'));
    act(() => result.current.addToRecentlyViewed('prod-3'));
    expect(result.current.count).toBe(2);
  });

  it('clearRecentlyViewed empties the list', () => {
    const { result } = renderHook(() => useRecentlyViewed());
    act(() => result.current.addToRecentlyViewed('prod-1'));
    act(() => result.current.clearRecentlyViewed());
    expect(result.current.count).toBe(0);
  });

  it('isRecentlyViewed checks presence', () => {
    const { result } = renderHook(() => useRecentlyViewed());
    act(() => result.current.addToRecentlyViewed('prod-1'));
    expect(result.current.isRecentlyViewed('prod-1')).toBe(true);
    expect(result.current.isRecentlyViewed('prod-2')).toBe(false);
  });
});

describe('getRecentlyViewedIds', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns empty array when no stored data', () => {
    expect(getRecentlyViewedIds('merchant-1')).toEqual([]);
  });

  it('returns stored product IDs', () => {
    const entries = [
      { productId: 'prod-1', viewedAt: Date.now() },
      { productId: 'prod-2', viewedAt: Date.now() },
    ];
    localStorage.setItem(
      'baci-recently-viewed-merchant-1',
      JSON.stringify(entries)
    );
    expect(getRecentlyViewedIds('merchant-1')).toEqual(['prod-1', 'prod-2']);
  });
});

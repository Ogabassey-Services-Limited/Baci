import { describe, expect, it } from 'vitest';
import { BoundedTtlCache } from './bounded-ttl-cache';

describe('BoundedTtlCache', () => {
  it('expires entries at the configured boundary', () => {
    let now = 1_000;
    const cache = new BoundedTtlCache<string>(60_000, 2, () => now);
    cache.set('store', 'ogabassey');

    now += 59_999;
    expect(cache.get('store')).toBe('ogabassey');

    now += 1;
    expect(cache.get('store')).toBeUndefined();
  });

  it('evicts the least recently used entry at capacity', () => {
    const cache = new BoundedTtlCache<string>(60_000, 2);
    cache.set('first', 'one');
    cache.set('second', 'two');
    expect(cache.get('first')).toBe('one');

    cache.set('third', 'three');

    expect(cache.get('second')).toBeUndefined();
    expect(cache.get('first')).toBe('one');
    expect(cache.get('third')).toBe('three');
  });

  it('deletes entries matching a value predicate', () => {
    const cache = new BoundedTtlCache<string>(60_000, 3);
    cache.set('old.example', 'retired-slug');
    cache.set('keep.example', 'current-slug');

    cache.deleteWhere((slug) => slug === 'retired-slug');

    expect(cache.get('old.example')).toBeUndefined();
    expect(cache.get('keep.example')).toBe('current-slug');
  });
});

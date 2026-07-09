import { describe, expect, it } from 'vitest';
import { getProductsEmptyState } from './products-empty-state';

describe('getProductsEmptyState', () => {
  it('returns a clear_search empty state with the query embedded when searching', () => {
    const result = getProductsEmptyState({
      activeTab: 'in_stock',
      searchQuery: 'iphone',
      variant: 'in_stock',
    });

    expect(result.action).toBe('clear_search');
    expect(result.buttonLabel).toBe('Clear Search');
    expect(result.title).toBe('No search results');
    expect(result.icon).toBe('search-outline');
    expect(result.description).toContain('iphone');
  });

  it('prioritises the search empty state over the active tab and variant', () => {
    const result = getProductsEmptyState({
      activeTab: 'low_stock',
      searchQuery: 'anything',
      variant: 'on_website',
    });

    expect(result.action).toBe('clear_search');
    expect(result.title).toBe('No search results');
  });

  it('treats a whitespace-only search query as no active search', () => {
    const result = getProductsEmptyState({
      activeTab: 'in_stock',
      searchQuery: '   ',
      variant: 'in_stock',
    });

    expect(result.action).toBe('add_product');
    expect(result.title).toBe('Start managing stock');
  });

  it('returns a null-action healthy-stock state for the low stock tab', () => {
    const result = getProductsEmptyState({
      activeTab: 'low_stock',
      searchQuery: '',
      variant: 'in_stock',
    });

    expect(result.action).toBeNull();
    expect(result.buttonLabel).toBeNull();
    expect(result.title).toBe('Stock levels healthy');
    expect(result.icon).toBe('shield-checkmark-outline');
  });

  it('returns a null-action nothing-depleted state for the out of stock tab', () => {
    const result = getProductsEmptyState({
      activeTab: 'out_of_stock',
      searchQuery: '',
      variant: 'in_stock',
    });

    expect(result.action).toBeNull();
    expect(result.buttonLabel).toBeNull();
    expect(result.title).toBe('Nothing depleted');
    expect(result.icon).toBe('checkmark-circle-outline');
  });

  it('returns an add_product state for the default in_stock tab', () => {
    const result = getProductsEmptyState({
      activeTab: 'in_stock',
      searchQuery: '',
      variant: 'in_stock',
    });

    expect(result.action).toBe('add_product');
    expect(result.buttonLabel).toBe('Add Stocked Item');
    expect(result.title).toBe('Start managing stock');
    expect(result.icon).toBe('calculator-outline');
  });

  it('returns an add_product state for the on_website variant regardless of tab', () => {
    const result = getProductsEmptyState({
      activeTab: 'categories',
      searchQuery: '',
      variant: 'on_website',
    });

    expect(result.action).toBe('add_product');
    expect(result.buttonLabel).toBe('Add Product');
    expect(result.title).toBe('No items on website');
    expect(result.icon).toBe('globe-outline');
  });
});

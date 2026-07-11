import { router } from 'expo-router';
import { Alert } from 'react-native';
import { describe, expect, it, vi } from 'vitest';
import {
  categoryKeyExtractor,
  handleCategoryPress,
  handleProductPress,
  productKeyExtractor,
} from './products-tab-page.helpers';

vi.mock('expo-router', () => ({
  router: { push: vi.fn() },
}));

vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
}));

describe('products-tab-page.helpers', () => {
  it('uses stable ids for product and category keys', () => {
    expect(productKeyExtractor({ id: 'product-1' })).toBe('product-1');
    expect(categoryKeyExtractor({ id: 'category-1' })).toBe('category-1');
  });

  it('navigates to the selected product detail screen', () => {
    handleProductPress('product-1');

    expect(router.push).toHaveBeenCalledWith('/product/product-1');
  });

  it('shows the category coming-soon message', () => {
    handleCategoryPress('category-1');

    expect(Alert.alert).toHaveBeenCalledWith(
      'Coming Soon',
      'Category filtering will be available in a future update.'
    );
  });
});

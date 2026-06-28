import { fireEvent, render, screen } from '@testing-library/react';
import { Animated } from 'react-native';
import { describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS } from '@/constants/theme';
import { ProductsSearchActions } from './ProductsSearchActions';

vi.mock('@react-native-vector-icons/ionicons', async () => {
  const React = await import('react');
  return {
    default: () => React.createElement('div', null),
  };
});

describe('ProductsSearchActions', () => {
  it('opens the scanner from the barcode action', () => {
    const onScanPress = vi.fn();

    render(
      <ProductsSearchActions
        colors={LIGHT_COLORS}
        isVisible={true}
        onClearSearch={vi.fn()}
        onScanPress={onScanPress}
        onSearchChange={vi.fn()}
        searchBarAnim={new Animated.Value(1)}
        searchQuery=""
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Scan barcode' }));

    expect(onScanPress).toHaveBeenCalledTimes(1);
  });

  it('clears an existing search query', () => {
    const onClearSearch = vi.fn();

    render(
      <ProductsSearchActions
        colors={LIGHT_COLORS}
        isVisible={true}
        onClearSearch={onClearSearch}
        onScanPress={vi.fn()}
        onSearchChange={vi.fn()}
        searchBarAnim={new Animated.Value(1)}
        searchQuery="iphone"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(onClearSearch).toHaveBeenCalledTimes(1);
  });

  it('disables controls while collapsed', () => {
    const onScanPress = vi.fn();

    render(
      <ProductsSearchActions
        colors={LIGHT_COLORS}
        isVisible={false}
        onClearSearch={vi.fn()}
        onScanPress={onScanPress}
        onSearchChange={vi.fn()}
        searchBarAnim={new Animated.Value(0)}
        searchQuery=""
      />
    );

    const scanButton = screen.getByRole('button', { name: 'Scan barcode' });
    fireEvent.click(scanButton);

    expect(onScanPress).not.toHaveBeenCalled();
  });
});

import { render } from '@testing-library/react-native';
import React from 'react';
import { FilterBar } from './FilterBar';
import * as useThemeHook from '@/hooks/useTheme';

// Mock vector icons
jest.mock('@expo/vector-icons', () => ({
  Feather: 'Feather',
  Ionicons: 'Ionicons',
}));

jest.mock('@/hooks/useTheme');

describe('FilterBar', () => {
  beforeEach(() => {
    (useThemeHook.useTheme as jest.Mock).mockReturnValue({
      colors: {
        background: '#FFF',
        border: '#E5E7EB',
        primary: '#EF4444',
        text: '#111827',
        textSecondary: '#4B5563',
        icon: '#9CA3AF',
        input: '#F3F4F6',
        card: '#FFF',
        promoBackground: '#FEF2F2',
        primaryLowOpacity: '#FEE2E2',
        primaryForeground: '#FFF',
        rating: '#B45309',
        mutedForeground: '#F59E0B',
        black: '#000',
      },
      isDark: false,
    });
  });

  it('renders correctly in light mode without crashing', () => {
    const { getByText } = render(
      <FilterBar
        categories={['Phones', 'Tablets']}
        selectedCategory="Phones"
        onSelectCategory={jest.fn()}
        minPrice={0}
        maxPrice={1000}
        onPriceChange={jest.fn()}
        brands={['Apple', 'Samsung']}
        selectedBrand="Apple"
        onSelectBrand={jest.fn()}
        selectedCondition="New"
        onSelectCondition={jest.fn()}
        minRating={4}
        onSelectRating={jest.fn()}
        viewMode="grid"
        onViewModeChange={jest.fn()}
      />
    );
    expect(getByText('Phones')).toBeTruthy();
    expect(getByText('Tablets')).toBeTruthy();
  });

  it('renders correctly in dark mode without crashing', () => {
    (useThemeHook.useTheme as jest.Mock).mockReturnValue({
      colors: {
        background: '#111827',
        border: '#374151',
        primary: '#F59E0B',
        text: '#F9FAFB',
        textSecondary: '#9CA3AF',
        icon: '#6B7280',
        input: '#1F2937',
        card: '#1F2937',
        promoBackground: '#374151',
        primaryLowOpacity: '#374151',
        primaryForeground: '#000',
        rating: '#F59E0B',
        mutedForeground: '#4B5563',
        black: '#000',
      },
      isDark: true,
    });

    const { getByText } = render(
      <FilterBar
        categories={['Laptops', 'Accessories']}
        selectedCategory="Laptops"
        onSelectCategory={jest.fn()}
        minPrice={0}
        maxPrice={1000}
        onPriceChange={jest.fn()}
        brands={['Apple', 'Samsung']}
        selectedBrand="Apple"
        onSelectBrand={jest.fn()}
        selectedCondition="New"
        onSelectCondition={jest.fn()}
        minRating={4}
        onSelectRating={jest.fn()}
        viewMode="grid"
        onViewModeChange={jest.fn()}
      />
    );
    expect(getByText('Laptops')).toBeTruthy();
    expect(getByText('Accessories')).toBeTruthy();
  });
});

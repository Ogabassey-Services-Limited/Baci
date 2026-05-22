import { render } from '@testing-library/react-native';
import React from 'react';
import { FilterBar } from './FilterBar';

// Mock vector icons
jest.mock('@expo/vector-icons', () => ({
  Feather: 'Feather',
  Ionicons: 'Ionicons',
}));

// Mock useTheme
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
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
  }),
}));

describe('FilterBar', () => {
  it('renders correctly without crashing', () => {
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
});

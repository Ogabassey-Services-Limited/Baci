import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text as MockText } from 'react-native';
import type { Product } from '@/types/product';
import { ProductGridView } from './ProductGridView';

jest.mock('@/components/ui/Skeleton', () => ({
  ProductGridSkeleton: ({ count }: { count: number }) => (
    <MockText>{`Skeleton ${count}`}</MockText>
  ),
}));

jest.mock('./FilterBar', () => ({
  FilterBar: () => <MockText>FilterBar</MockText>,
}));

jest.mock('./ProductCard', () => ({
  ProductCard: ({ product }: { product: Product }) => (
    <MockText>{product.id}</MockText>
  ),
}));

const defaultProps = {
  blockTitle: 'Featured Products',
  brands: ['All'],
  categoryNames: ['All'],
  currentVariant: 'grid' as const,
  isFetching: false,
  isLoading: false,
  isLoadingMore: false,
  isRetrying: false,
  maxPrice: 1_000_000,
  minPrice: 0,
  minRating: 0,
  onBrandFilterVisible: jest.fn(),
  onPriceChange: jest.fn(),
  onRetry: jest.fn(),
  onSelectBrand: jest.fn(),
  onSelectCategory: jest.fn(),
  onSelectCondition: jest.fn(),
  onSelectRating: jest.fn(),
  onViewModeChange: jest.fn(),
  selectedBrand: 'All',
  selectedCategoryName: 'All',
  selectedCondition: 'All',
  shouldShowFatalError: false,
  shouldShowInitialLoading: false,
  uniqueVisibleProducts: [] as Product[],
  viewMode: 'grid' as const,
};

describe('ProductGridView', () => {
  it('renders fatal error state and retries when pressed', () => {
    render(
      <ProductGridView
        {...defaultProps}
        shouldShowFatalError={true}
        onRetry={defaultProps.onRetry}
      />
    );

    fireEvent.press(
      screen.getByRole('button', { name: 'Retry loading products' })
    );
    expect(defaultProps.onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders skeleton while loading', () => {
    render(<ProductGridView {...defaultProps} isLoading={true} />);
    expect(screen.getByText('Skeleton 4')).toBeOnTheScreen();
  });

  it('renders product cards and loading-more indicator', () => {
    render(
      <ProductGridView
        {...defaultProps}
        isLoadingMore={true}
        uniqueVisibleProducts={[{ id: 'prod-1' } as Product]}
      />
    );

    expect(screen.getByText('prod-1')).toBeOnTheScreen();
    expect(screen.getByLabelText('Loading more products')).toBeOnTheScreen();
  });
});

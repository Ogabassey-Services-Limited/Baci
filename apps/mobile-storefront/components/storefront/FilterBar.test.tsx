import { fireEvent, render, screen } from '@testing-library/react-native';
import { FilterBar } from './FilterBar';

jest.mock('@react-native-vector-icons/feather', () => {
  return function MockFeather() {
    return null;
  };
});

describe('FilterBar', () => {
  const defaultProps = {
    categories: ['All', 'Phones'],
    selectedCategory: 'All',
    onSelectCategory: jest.fn(),
    minPrice: 0,
    maxPrice: 3000000,
    onPriceChange: jest.fn(),
    brands: ['Apple', 'Samsung'],
    onBrandFilterVisible: jest.fn(),
    selectedBrand: 'All',
    onSelectBrand: jest.fn(),
    selectedCondition: 'All',
    onSelectCondition: jest.fn(),
    minRating: 0,
    onSelectRating: jest.fn(),
    viewMode: 'grid' as const,
    onViewModeChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('announces selected categories and filter menu expansion state', () => {
    render(<FilterBar {...defaultProps} selectedCategory="Phones" />);

    expect(
      screen.getByRole('button', { name: 'All category' }).props
        .accessibilityState
    ).toEqual({ selected: false });
    expect(
      screen.getByRole('button', { name: 'Phones category' }).props
        .accessibilityState
    ).toEqual({ selected: true });

    const filterMenuToggle = screen.getByRole('button', {
      name: 'Toggle filter menu',
    });
    expect(filterMenuToggle.props.accessibilityState).toEqual({
      expanded: false,
    });

    fireEvent.press(filterMenuToggle);

    expect(
      screen.getByRole('button', { name: 'Toggle filter menu' }).props
        .accessibilityState
    ).toEqual({ expanded: true });
    expect(
      screen
        .getAllByRole('button', { name: 'Price Range' })
        .some((button) =>
          Object.is(button.props.accessibilityState?.selected, true)
        )
    ).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Brand' }).props.accessibilityState
    ).toEqual({ selected: false });
  });

  it('renders grid and list view toggles with proper accessibility props and handles toggling', () => {
    const { rerender } = render(<FilterBar {...defaultProps} />);

    const gridToggle = screen.getByRole('button', { name: 'Grid view' });
    const listToggle = screen.getByRole('button', { name: 'List view' });

    expect(gridToggle).toBeOnTheScreen();
    expect(gridToggle.props.accessibilityState).toEqual({ selected: true });

    expect(listToggle).toBeOnTheScreen();
    expect(listToggle.props.accessibilityState).toEqual({ selected: false });

    fireEvent.press(listToggle);
    expect(defaultProps.onViewModeChange).toHaveBeenCalledWith('list');

    rerender(<FilterBar {...defaultProps} viewMode="list" />);

    expect(
      screen.getByRole('button', { name: 'Grid view' }).props.accessibilityState
    ).toEqual({ selected: false });
    expect(
      screen.getByRole('button', { name: 'List view' }).props.accessibilityState
    ).toEqual({ selected: true });

    fireEvent.press(screen.getByRole('button', { name: 'Grid view' }));
    expect(defaultProps.onViewModeChange).toHaveBeenCalledWith('grid');
  });
});

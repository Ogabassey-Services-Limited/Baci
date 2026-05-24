import { render, fireEvent, screen } from '@testing-library/react-native';
import React from 'react';
import { CompareButton } from './CompareButton';
import { useComparisonStore } from '@/stores/comparison-store';

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('@/stores/comparison-store', () => ({
  useComparisonStore: jest.fn(),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

describe('CompareButton', () => {
  const mockProduct = {
    id: 'prod-123',
    name: 'Test Product',
    price: 1000,
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly when product is NOT in comparison', () => {
    (useComparisonStore as unknown as jest.Mock).mockImplementation((selector: any) => {
      const state = {
        isInComparison: () => false,
        canAdd: () => true,
        toggleComparison: jest.fn(),
      };
      return selector(state);
    });

    render(<CompareButton product={mockProduct} />);

    const button = screen.getByRole('button');
    expect(button.props.accessibilityLabel).toBe('Add to comparison');
    expect(button.props.accessibilityState).toEqual({ checked: false });
    expect(screen.getByText('Compare')).toBeTruthy();
  });

  it('renders correctly when product IS in comparison', () => {
    (useComparisonStore as unknown as jest.Mock).mockImplementation((selector: any) => {
      const state = {
        isInComparison: () => true,
        canAdd: () => true,
        toggleComparison: jest.fn(),
      };
      return selector(state);
    });

    render(<CompareButton product={mockProduct} />);

    const button = screen.getByRole('button');
    expect(button.props.accessibilityLabel).toBe('Remove from comparison');
    expect(button.props.accessibilityState).toEqual({ checked: true });
    expect(screen.getByText('Added')).toBeTruthy();
  });

  it('calls toggleComparison when pressed', () => {
    const mockToggle = jest.fn();
    (useComparisonStore as unknown as jest.Mock).mockImplementation((selector: any) => {
      const state = {
        isInComparison: () => false,
        canAdd: () => true,
        toggleComparison: mockToggle,
      };
      return selector(state);
    });

    render(<CompareButton product={mockProduct} />);

    const button = screen.getByRole('button');
    fireEvent.press(button);

    expect(mockToggle).toHaveBeenCalledWith(mockProduct);
  });
});

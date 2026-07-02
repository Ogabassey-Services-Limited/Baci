import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { ImeiBrandChips } from './ImeiBrandChips';

jest.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,
  default: () => null,
  __esModule: true,
}));

const baseProps = {
  colors: Colors.light,
  selectedBrand: 'apple' as const,
  onBrandSelect: jest.fn(),
};

describe('ImeiBrandChips', () => {
  it('renders per-manufacturer chips with no redundant "All"', () => {
    render(<ImeiBrandChips {...baseProps} />);

    expect(screen.queryByText('All')).toBeNull();
    expect(screen.getByText('Apple')).toBeTruthy();
    expect(screen.getByText('Samsung')).toBeTruthy();
    expect(screen.getByText('Xiaomi')).toBeTruthy();
    expect(screen.getByText('Google')).toBeTruthy();
    expect(screen.getByText('Tecno')).toBeTruthy();
  });

  it('reports the chip identifier when a brand is pressed', () => {
    const onBrandSelect = jest.fn();
    render(<ImeiBrandChips {...baseProps} onBrandSelect={onBrandSelect} />);

    fireEvent.press(screen.getByText('Samsung'));

    expect(onBrandSelect).toHaveBeenCalledWith('samsung');
  });
});

import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import Colors from '@/constants/Colors';
import { UtilityTypeTabs } from './UtilityTypeTabs';

let mockColorScheme: 'light' | 'dark' = 'light';

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => mockColorScheme,
}));

describe('UtilityTypeTabs', () => {
  beforeEach(() => {
    mockColorScheme = 'light';
  });

  it('renders utility submenus and marks the selected type', () => {
    render(<UtilityTypeTabs selectedType="power" onSelect={jest.fn()} />);

    expect(screen.getByText('Airtime')).toBeOnTheScreen();
    expect(screen.getByText('Data')).toBeOnTheScreen();
    expect(screen.getByText('TV')).toBeOnTheScreen();
    expect(screen.getByText('Power')).toBeOnTheScreen();
    expect(screen.getByText('Gaming')).toBeOnTheScreen();
    expect(screen.getAllByRole('tab')).toHaveLength(5);
  });

  it('marks the selected type as selected', () => {
    render(<UtilityTypeTabs selectedType="power" onSelect={jest.fn()} />);

    expect(
      screen.getByLabelText('Power utility service')
    ).toHaveAccessibilityState({
      selected: true,
    });
  });

  it('calls onSelect when a submenu is pressed', () => {
    const onSelect = jest.fn();
    render(<UtilityTypeTabs selectedType="power" onSelect={onSelect} />);

    fireEvent.press(screen.getByLabelText('Data utility service'));

    expect(onSelect).toHaveBeenCalledWith('data');
  });

  it('applies dark theme styling', () => {
    mockColorScheme = 'dark';

    render(<UtilityTypeTabs selectedType="data" onSelect={jest.fn()} />);

    // React Native Testing Library does not expose this non-focusable tablist
    // View through getByRole('tablist'), so UNSAFE_getByProps plus
    // StyleSheet.flatten intentionally verifies the container style contract.
    const tablist = screen.UNSAFE_getByProps({
      accessibilityRole: 'tablist',
    });
    expect(StyleSheet.flatten(tablist.props.style)).toMatchObject({
      backgroundColor: Colors.dark.background,
      borderBottomColor: Colors.dark.border,
    });
    expect(screen.getByText('Airtime')).toHaveStyle({
      color: Colors.dark.text,
    });
  });

  it('marks the selected tab in dark mode', () => {
    mockColorScheme = 'dark';

    render(<UtilityTypeTabs selectedType="data" onSelect={jest.fn()} />);

    expect(
      screen.getByLabelText('Data utility service')
    ).toHaveAccessibilityState({
      selected: true,
    });
  });
});

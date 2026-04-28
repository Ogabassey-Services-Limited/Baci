import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { UtilityTypeTabs } from './UtilityTypeTabs';

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

describe('UtilityTypeTabs', () => {
  it('renders utility submenus and marks the selected type', () => {
    render(<UtilityTypeTabs selectedType="power" onSelect={jest.fn()} />);

    expect(screen.getByText('Airtime')).toBeOnTheScreen();
    expect(screen.getByText('Data')).toBeOnTheScreen();
    expect(screen.getByText('TV')).toBeOnTheScreen();
    expect(screen.getByText('Power')).toBeOnTheScreen();
    expect(screen.getByText('Gaming')).toBeOnTheScreen();
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
});

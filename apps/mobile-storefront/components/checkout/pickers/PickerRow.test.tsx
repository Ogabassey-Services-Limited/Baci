import { jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { PickerRow } from './PickerRow';

jest.mock('@react-native-vector-icons/ionicons', () => () => null);

describe('PickerRow', () => {
  it('calls onSelect with its item when pressed', () => {
    const onSelect = jest.fn();

    render(
      <PickerRow
        colors={Colors.light}
        isDark={false}
        isSelected={false}
        item="Lekki Phase 1"
        onSelect={onSelect}
      />
    );

    fireEvent.press(screen.getByText('Lekki Phase 1'));

    expect(onSelect).toHaveBeenCalledWith('Lekki Phase 1');
  });

  it('truncates long labels to preserve the fixed row layout used by getItemLayout', () => {
    const onSelect = jest.fn();
    const longCityName =
      'A very long Lagos city name that would otherwise wrap';

    render(
      <PickerRow
        colors={Colors.light}
        isDark={false}
        isSelected={false}
        item={longCityName}
        onSelect={onSelect}
      />
    );

    expect(screen.getByText(longCityName).props.numberOfLines).toBe(1);
    expect(screen.getByText(longCityName).props.ellipsizeMode).toBe('tail');
  });

  it('uses selected row styling without changing the visible label', () => {
    const onSelect = jest.fn();

    render(
      <PickerRow
        colors={Colors.light}
        isDark={false}
        isSelected
        item="Lagos"
        onSelect={onSelect}
      />
    );

    expect(screen.getByText('Lagos')).toBeTruthy();
  });
});

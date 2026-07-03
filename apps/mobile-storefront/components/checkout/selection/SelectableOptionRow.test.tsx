import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import Colors, { BRAND } from '@/constants/Colors';
import { SelectableOptionRow } from './SelectableOptionRow';

const colors = Colors.dark;

function rowStyle() {
  return StyleSheet.flatten(
    screen.getByTestId('selectable-option-row').props.style
  );
}

describe('SelectableOptionRow', () => {
  it('renders title, subtitle, and trailing content', () => {
    render(
      <SelectableOptionRow
        selected={false}
        onPress={() => {}}
        colors={colors}
        icon="cube-outline"
        title="Door delivery"
        subtitle="2–3 working days"
        trailing={<Text>₦2,500</Text>}
      />
    );

    expect(screen.getByText('Door delivery')).toBeTruthy();
    expect(screen.getByText('2–3 working days')).toBeTruthy();
    expect(screen.getByText('₦2,500')).toBeTruthy();
  });

  it('reveals children only while selected and exposes the radio state', () => {
    const { rerender } = render(
      <SelectableOptionRow
        selected={false}
        onPress={() => {}}
        colors={colors}
        title="Pick Up Station"
      >
        <Text>PICKUP_ADDRESS</Text>
      </SelectableOptionRow>
    );
    expect(screen.queryByText('PICKUP_ADDRESS')).toBeNull();
    expect(
      screen.getByRole('radio', { name: 'Pick Up Station' }).props
        .accessibilityState
    ).toMatchObject({ checked: false });

    rerender(
      <SelectableOptionRow
        selected
        onPress={() => {}}
        colors={colors}
        title="Pick Up Station"
      >
        <Text>PICKUP_ADDRESS</Text>
      </SelectableOptionRow>
    );
    expect(screen.getByText('PICKUP_ADDRESS')).toBeTruthy();
    expect(
      screen.getByRole('radio', { name: 'Pick Up Station' }).props
        .accessibilityState
    ).toMatchObject({ checked: true });
  });

  it('uses a red border when selected (not nested), tint when nested', () => {
    const { rerender } = render(
      <SelectableOptionRow
        selected
        onPress={() => {}}
        colors={colors}
        title="Door"
      />
    );
    expect(rowStyle().borderColor).toBe(BRAND.primary);

    rerender(
      <SelectableOptionRow
        selected
        nested
        onPress={() => {}}
        colors={colors}
        title="Door"
      />
    );
    // Nested: no second red border, a subtle tint instead.
    expect(rowStyle().borderColor).toBe(colors.border);
    expect(rowStyle().backgroundColor).toBe(BRAND.primaryAlpha06);
  });

  it('fires onPress when tapped and blocks it when disabled', () => {
    const onPress = jest.fn();
    const { rerender } = render(
      <SelectableOptionRow
        selected={false}
        onPress={onPress}
        colors={colors}
        title="Airport"
      />
    );
    fireEvent.press(screen.getByRole('radio', { name: 'Airport' }));
    expect(onPress).toHaveBeenCalledTimes(1);

    onPress.mockClear();
    rerender(
      <SelectableOptionRow
        selected={false}
        onPress={onPress}
        colors={colors}
        title="Airport"
        disabled
      />
    );
    fireEvent.press(screen.getByRole('radio', { name: 'Airport' }));
    expect(onPress).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import Colors, { BRAND, SPACING } from '@/constants/Colors';
import { UtilityTypeTabs } from './UtilityTypeTabs';

let mockColorScheme: 'light' | 'dark' = 'light';

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => mockColorScheme,
}));

function getTabStyle(testID: string) {
  const style = screen.getByTestId(testID).props.style;
  return StyleSheet.flatten(
    typeof style === 'function' ? style({ pressed: false }) : style
  );
}

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

  it.each([
    ['light', Colors.light],
    ['dark', Colors.dark],
  ] as const)(
    'marks the selected type and applies %s theme styling',
    (colorScheme, expectedColors) => {
      mockColorScheme = colorScheme;

      render(<UtilityTypeTabs selectedType="data" onSelect={jest.fn()} />);

      expect(
        screen.getByLabelText('Data utility service')
      ).toHaveAccessibilityState({
        selected: true,
      });
      expect(
        StyleSheet.flatten(screen.getByTestId('utility-type-tabs').props.style)
      ).toMatchObject({
        backgroundColor: expectedColors.background,
        borderBottomColor: expectedColors.border,
      });
      expect(screen.getByText('Airtime')).toHaveStyle({
        color: expectedColors.text,
      });
    }
  );

  it('keeps utility submenus rendered as horizontal pills', () => {
    render(<UtilityTypeTabs selectedType="power" onSelect={jest.fn()} />);

    expect(getTabStyle('utility-tab-power')).toMatchObject({
      backgroundColor: BRAND.primary,
      borderColor: BRAND.primary,
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: 'row',
      flexShrink: 0,
      width: 92,
    });
    expect(getTabStyle('utility-tab-airtime')).toMatchObject({
      backgroundColor: Colors.light.muted,
      borderColor: Colors.light.border,
      marginRight: SPACING.sm,
      width: 96,
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('utility-type-tabs-scroll').props
          .contentContainerStyle
      )
    ).toMatchObject({
      alignItems: 'center',
      paddingHorizontal: SPACING.md,
    });
  });

  it('calls onSelect when a submenu is pressed', () => {
    const onSelect = jest.fn();
    render(<UtilityTypeTabs selectedType="power" onSelect={onSelect} />);

    fireEvent.press(screen.getByLabelText('Data utility service'));

    expect(onSelect).toHaveBeenCalledWith('data');
  });
});

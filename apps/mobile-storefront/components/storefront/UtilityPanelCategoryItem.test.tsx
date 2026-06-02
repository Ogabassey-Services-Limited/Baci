import { jest } from '@jest/globals';

jest.mock('react-native-reanimated', () => {
  const { View, Text } = jest.requireActual('react-native') as Record<
    string,
    unknown
  >;

  return {
    __esModule: true,
    default: { View, Text },
    View,
    Text,
    cancelAnimation: jest.fn(),
    useAnimatedStyle: (updater: () => object) => updater(),
    useSharedValue: (value: number) => ({ value }),
    withTiming: (value: number) => value,
    withSpring: (value: number) => value,
    interpolate: (
      value: number,
      inputRange: number[],
      outputRange: number[]
    ) => {
      const idx = inputRange.indexOf(value);
      if (idx !== -1) return outputRange[idx];
      return outputRange[0];
    },
    interpolateColor: (
      value: number,
      inputRange: number[],
      outputRange: string[]
    ) => {
      const idx = inputRange.indexOf(value);
      if (idx !== -1) return outputRange[idx];
      return outputRange[0];
    },
    Extrapolation: {
      CLAMP: 'clamp',
    },
  };
});

import { fireEvent, render, screen } from '@testing-library/react-native';
import type { SharedValue } from 'react-native-reanimated';
import Colors, { BRAND } from '@/constants/Colors';
import { findHostElement } from '@/test-support/find-host-element';
import { UtilityPanelCategoryItem } from './UtilityPanelCategoryItem';

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

describe('UtilityPanelCategoryItem', () => {
  it('renders an active utility and invokes its action', () => {
    const onPress = jest.fn();

    render(
      <UtilityPanelCategoryItem
        id="u-airtime"
        name="Airtime"
        iconName="call-outline"
        variant="circle"
        isActive
        onPress={onPress}
      />
    );

    const airtimeButton = screen.getByRole('button', { name: 'Airtime' });
    expect(findHostElement(airtimeButton.children[0])).toHaveStyle({
      backgroundColor: Colors.light.card,
    });

    fireEvent.press(airtimeButton);

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not render non-circle utility variants', () => {
    render(
      <UtilityPanelCategoryItem
        id="u-data"
        name="Data"
        iconName="wifi"
        variant="card"
        isActive={false}
        onPress={jest.fn()}
      />
    );

    expect(screen.queryByLabelText('Data')).toBeNull();
  });

  it('uses activeIndex to render active utility styling', () => {
    const onPress = jest.fn();

    render(
      <UtilityPanelCategoryItem
        id="u-airtime"
        name="Airtime"
        iconName="call-outline"
        variant="circle"
        isActive={false}
        activeIndex={{ value: 0 } as SharedValue<number>}
        index={0}
        onPress={onPress}
      />
    );

    expect(
      findHostElement(screen.getByTestId('utility-category-icon-u-airtime'))
    ).toHaveStyle({
      backgroundColor: Colors.light.card,
      borderColor: BRAND.primary,
      borderWidth: 1,
    });

    fireEvent.press(screen.getByRole('button', { name: 'Airtime' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('uses activeIndex to render inactive utility styling', () => {
    render(
      <UtilityPanelCategoryItem
        id="u-airtime"
        name="Airtime"
        iconName="call-outline"
        variant="circle"
        isActive
        activeIndex={{ value: 1 } as SharedValue<number>}
        index={0}
        onPress={jest.fn()}
      />
    );

    expect(
      findHostElement(screen.getByTestId('utility-category-icon-u-airtime'))
    ).toHaveStyle({
      backgroundColor: Colors.light.muted,
      borderColor: 'transparent',
      borderWidth: 0,
    });
  });
});

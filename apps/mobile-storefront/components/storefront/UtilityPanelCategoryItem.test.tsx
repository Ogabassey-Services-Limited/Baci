import { jest } from '@jest/globals';

jest.mock('react-native-reanimated', () => {
  const { View, Text } = jest.requireActual('react-native') as Record<string, unknown>;

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
  };
});

import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
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
});

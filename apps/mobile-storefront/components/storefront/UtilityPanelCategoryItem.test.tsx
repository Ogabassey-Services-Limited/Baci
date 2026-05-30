import { jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import Colors from '@/constants/Colors';
import { UtilityPanelCategoryItem } from './UtilityPanelCategoryItem';

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

function getIconStyle(button: ReturnType<typeof screen.getByRole>) {
  const icon = button.children[0];
  if (!icon || typeof icon === 'string') {
    throw new Error('Expected utility button to render an icon element');
  }
  return StyleSheet.flatten(icon.props.style);
}

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
    expect(getIconStyle(airtimeButton)?.backgroundColor).toBe(
      Colors.light.card
    );

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

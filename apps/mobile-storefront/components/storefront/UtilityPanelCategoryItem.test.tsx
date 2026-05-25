import { jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
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

    expect(screen.getByTestId('utility-category-icon-u-airtime')).toHaveStyle({
      backgroundColor: Colors.light.selectedIconBackground,
    });

    fireEvent.press(screen.getByLabelText('Airtime'));

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

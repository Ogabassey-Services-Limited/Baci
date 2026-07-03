import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { CheckoutCheckbox } from './CheckoutCheckbox';

const colors = Colors.dark;

describe('CheckoutCheckbox', () => {
  it('renders its label and reflects the checked state', () => {
    render(
      <CheckoutCheckbox
        checked
        onPress={() => {}}
        colors={colors}
        label="Set as default address"
      />
    );

    const box = screen.getByRole('checkbox', {
      name: 'Set as default address',
    });
    expect(box.props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByText('Set as default address')).toBeTruthy();
  });

  it('fires onPress when tapped and blocks it when disabled', () => {
    const onPress = jest.fn();
    const { rerender } = render(
      <CheckoutCheckbox
        checked={false}
        onPress={onPress}
        colors={colors}
        label="Save my details"
      />
    );

    fireEvent.press(screen.getByRole('checkbox', { name: 'Save my details' }));
    expect(onPress).toHaveBeenCalledTimes(1);

    onPress.mockClear();
    rerender(
      <CheckoutCheckbox
        checked={false}
        onPress={onPress}
        colors={colors}
        label="Save my details"
        disabled
      />
    );
    fireEvent.press(screen.getByRole('checkbox', { name: 'Save my details' }));
    expect(onPress).not.toHaveBeenCalled();
  });
});

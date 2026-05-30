import { jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { DataFormFooter } from './DataFormFooter';

describe('DataFormFooter', () => {
  it('renders the gateway continuation action', () => {
    const onPress = jest.fn();

    render(
      <DataFormFooter
        bottomInset={0}
        bottomOffset={0}
        colors={Colors.light}
        isKeyboardVisible={false}
        isSubmitting={false}
        planAmount={3500}
        selectedSavedCardId={null}
        onPress={onPress}
      />
    );

    fireEvent.press(screen.getByText('Continue to Payment'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders saved-card amount copy', () => {
    render(
      <DataFormFooter
        bottomInset={0}
        bottomOffset={0}
        colors={Colors.light}
        isKeyboardVisible={false}
        isSubmitting={false}
        planAmount={3500}
        selectedSavedCardId="saved-card-1"
        onPress={jest.fn()}
      />
    );

    expect(screen.getByText('Pay ₦3,500')).toBeOnTheScreen();
  });
});

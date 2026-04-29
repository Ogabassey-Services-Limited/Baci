import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import PurchaseUpsellCard from './PurchaseUpsellCard';

describe('PurchaseUpsellCard', () => {
  it('renders account creation copy and invokes the callback', () => {
    const onCreateAccount = jest.fn();

    render(
      <PurchaseUpsellCard
        colors={Colors.light}
        onCreateAccount={onCreateAccount}
      />
    );

    expect(screen.getByText('Save this beneficiary?')).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText('Create account'));

    expect(onCreateAccount).toHaveBeenCalledTimes(1);
  });
});

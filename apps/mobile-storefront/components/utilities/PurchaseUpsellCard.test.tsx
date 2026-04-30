import { fireEvent, render, screen } from '@testing-library/react-native';
import PurchaseUpsellCard from '@/components/utilities/PurchaseUpsellCard';
import Colors from '@/constants/Colors';

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

  it('prevents account creation while disabled', () => {
    const onCreateAccount = jest.fn();

    render(
      <PurchaseUpsellCard
        colors={Colors.light}
        disabled={true}
        onCreateAccount={onCreateAccount}
      />
    );

    const button = screen.getByLabelText('Create account');

    expect(button).toBeDisabled();
    fireEvent.press(button);
    expect(onCreateAccount).not.toHaveBeenCalled();
  });

  it('shows busy state while loading', () => {
    const onCreateAccount = jest.fn();

    render(
      <PurchaseUpsellCard
        colors={Colors.light}
        isLoading={true}
        onCreateAccount={onCreateAccount}
      />
    );

    const button = screen.getByLabelText('Create account');

    expect(screen.getByText('Creating Account...')).toBeOnTheScreen();
    expect(button).toBeDisabled();
    fireEvent.press(button);
    expect(onCreateAccount).not.toHaveBeenCalled();
  });
});

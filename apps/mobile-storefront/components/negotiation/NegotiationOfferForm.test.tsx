import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { NegotiationOfferForm } from './NegotiationOfferForm';

jest.mock('react-native-reanimated', () => {
  const { View } =
    jest.requireActual<typeof import('react-native')>('react-native');

  return {
    __esModule: true,
    default: { View },
    View,
    FadeIn: {
      duration: () => ({}),
    },
  };
});

describe('NegotiationOfferForm', () => {
  it('renders the current offer and submits user input', () => {
    const onOfferChange = jest.fn();
    const onSubmitPress = jest.fn();

    render(
      <NegotiationOfferForm
        offer="450000"
        onOfferChange={onOfferChange}
        onSubmitPress={onSubmitPress}
      />
    );

    fireEvent.changeText(
      screen.getByLabelText('Your offer amount in naira'),
      '440000'
    );
    fireEvent.press(screen.getByRole('button', { name: 'Submit your offer' }));

    expect(screen.getByText('Your offer')).toBeTruthy();
    expect(screen.getByText('₦')).toBeTruthy();
    expect(onOfferChange).toHaveBeenCalledWith('440000');
    expect(onSubmitPress).toHaveBeenCalledTimes(1);
  });
});

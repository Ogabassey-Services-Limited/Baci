import { expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { BRAND } from '@/constants/Colors';
import { CheckoutBottomAction } from './CheckoutBottomAction';

const colors = {
  border: '#222222',
  card: '#111111',
  muted: '#262626',
  text: '#FFFFFF',
  textSecondary: '#AAAAAA',
} as Parameters<typeof CheckoutBottomAction>[0]['colors'];

it('blocks review submission until a payment instrument is selected', () => {
  const onPlaceOrder = jest.fn();
  const props: Parameters<typeof CheckoutBottomAction>[0] = {
    animatedCtaArrowStyle: {},
    canContinue: true,
    colors,
    displayTotal: 120_000,
    insetsBottom: 0,
    isProcessing: false,
    itemCount: 1,
    onContinue: jest.fn(),
    onPlaceOrder,
    selectedPayment: null,
    step: 'review',
    total: 120_000,
  };
  const { rerender } = render(<CheckoutBottomAction {...props} />);

  const disabledButton = screen.getByRole('button', { name: /place order/i });
  expect(disabledButton.props.accessibilityState.disabled).toBe(true);
  fireEvent.press(disabledButton);
  expect(onPlaceOrder).not.toHaveBeenCalled();

  rerender(<CheckoutBottomAction {...props} selectedPayment="paystack" />);
  const enabledButton = screen.getByRole('button', { name: /place order/i });
  expect(enabledButton.props.accessibilityState.disabled).toBe(false);
  fireEvent.press(enabledButton);
  expect(onPlaceOrder).toHaveBeenCalledTimes(1);
});

it('keeps the address continue action disabled until the form and rate are ready', () => {
  const onContinue = jest.fn();
  const props: Parameters<typeof CheckoutBottomAction>[0] = {
    animatedCtaArrowStyle: {},
    canContinue: false,
    colors,
    displayTotal: 120_000,
    insetsBottom: 0,
    isProcessing: false,
    itemCount: 1,
    onContinue,
    onPlaceOrder: jest.fn(),
    selectedPayment: null,
    step: 'address',
    total: 120_000,
  };
  const { rerender } = render(<CheckoutBottomAction {...props} />);

  const disabledButton = screen.getByRole('button', {
    name: /continue to payment/i,
  });
  expect(disabledButton.props.accessibilityState.disabled).toBe(true);
  expect(disabledButton.props.style).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ backgroundColor: colors.muted }),
    ])
  );
  fireEvent.press(disabledButton);
  expect(onContinue).not.toHaveBeenCalled();

  rerender(<CheckoutBottomAction {...props} canContinue />);
  const enabledButton = screen.getByRole('button', {
    name: /continue to payment/i,
  });
  expect(enabledButton.props.accessibilityState.disabled).toBe(false);
  expect(enabledButton.props.style).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ backgroundColor: BRAND.primary }),
    ])
  );
  fireEvent.press(enabledButton);
  expect(onContinue).toHaveBeenCalledTimes(1);
});

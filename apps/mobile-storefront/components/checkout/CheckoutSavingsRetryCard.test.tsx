import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { CheckoutSavingsRetryCard } from './CheckoutSavingsRetryCard';

describe('CheckoutSavingsRetryCard', () => {
  it('renders the savings retry message and calls retry', () => {
    const onRetry = jest.fn();

    render(
      <CheckoutSavingsRetryCard
        colors={Colors.light}
        isDark={false}
        message="Unable to load your savings balance."
        onRetry={onRetry}
      />
    );

    expect(screen.getByText('Savings unavailable')).toBeOnTheScreen();
    expect(
      screen.getByText('Unable to load your savings balance.')
    ).toBeOnTheScreen();

    fireEvent.press(
      screen.getByRole('button', { name: 'Retry checkout savings' })
    );

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it.each([
    { colors: Colors.light, isDark: false, label: 'light' },
    { colors: Colors.dark, isDark: true, label: 'dark' },
  ])('renders retry chrome in $label mode', ({ colors, isDark }) => {
    render(
      <CheckoutSavingsRetryCard
        colors={colors}
        isDark={isDark}
        message="Try again later."
        onRetry={jest.fn()}
      />
    );

    expect(screen.getByText('Savings unavailable')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Retry checkout savings' })
    ).toBeOnTheScreen();
  });

  it('renders long and special-character messages literally', () => {
    const message = 'Unable to load savings <balance> & retry ₦20,000. '
      .repeat(4)
      .trim();

    render(
      <CheckoutSavingsRetryCard
        colors={Colors.light}
        isDark={false}
        message={message}
        onRetry={jest.fn()}
      />
    );

    expect(screen.getByText(message)).toBeOnTheScreen();
  });

  it('keeps the retry control mounted when the delegated handler throws', () => {
    const onRetry = jest.fn(() => {
      throw new Error('Retry failed');
    });

    render(
      <CheckoutSavingsRetryCard
        colors={Colors.light}
        isDark={false}
        message="Savings service unavailable."
        onRetry={onRetry}
      />
    );

    const retryButton = screen.getByRole('button', {
      name: 'Retry checkout savings',
    });

    expect(() => fireEvent.press(retryButton)).toThrow('Retry failed');
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('button', { name: 'Retry checkout savings' })
    ).toBeOnTheScreen();
  });
});

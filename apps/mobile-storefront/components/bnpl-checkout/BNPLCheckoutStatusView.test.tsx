import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type React from 'react';
import Colors from '@/constants/Colors';
import { BNPLCheckoutStatusView } from './BNPLCheckoutStatusView';

jest.mock('expo-router', () => ({
  Stack: {
    Screen: () => null,
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => children,
}));

describe('BNPLCheckoutStatusView', () => {
  const colors = Colors.light;

  it('explains invalid checkout parameters and allows the customer to leave', () => {
    const onBack = jest.fn();

    render(
      <BNPLCheckoutStatusView
        colors={colors}
        message="Invalid payment gateway"
        onBack={onBack}
        variant="invalid"
      />
    );

    expect(screen.getByText('Invalid payment gateway')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Go back' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('exposes retry and back actions when a provider fails', () => {
    const onBack = jest.fn();
    const onRetry = jest.fn();

    render(
      <BNPLCheckoutStatusView
        colors={colors}
        gatewayName="Credit Direct"
        message="Provider connection failed"
        onBack={onBack}
        onRetry={onRetry}
        variant="error"
      />
    );

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Provider connection failed')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Try payment again' }));
    fireEvent.press(screen.getByRole('button', { name: 'Go back' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('supports a custom retry action label for device settings', () => {
    const onRetry = jest.fn();

    render(
      <BNPLCheckoutStatusView
        colors={colors}
        gatewayName="Credit Direct"
        message="Enable camera access in device settings."
        onBack={jest.fn()}
        onRetry={onRetry}
        retryAccessibilityLabel="Open app settings"
        retryLabel="Open Settings"
        variant="error"
      />
    );

    fireEvent.press(screen.getByRole('button', { name: 'Open app settings' }));

    expect(screen.getByText('Open Settings')).toBeTruthy();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('announces the successful provider handoff while redirecting', () => {
    render(
      <BNPLCheckoutStatusView
        colors={colors}
        gatewayName="Klump"
        variant="success"
      />
    );

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(
      screen.getByText(
        'Your Klump payment has been approved. Redirecting to order confirmation…'
      )
    ).toBeTruthy();
    expect(
      screen.getByLabelText('Redirecting after payment success')
    ).toBeTruthy();
  });
});

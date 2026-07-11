import { expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import {
  PaymentMethodSelector,
  type PaymentMethodType,
  type PaymentTab,
} from './PaymentMethodSelector';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

function UnselectedPaymentSelector() {
  const [selectedMethod, setSelectedMethod] =
    useState<PaymentMethodType | null>(null);
  const [selectedTab, setSelectedTab] = useState<PaymentTab | null>(null);

  return (
    <PaymentMethodSelector
      enabledMethods={['paystack', 'credit_direct', 'invoice', 'payforme']}
      initiallyCollapsed
      onSelectMethod={setSelectedMethod}
      onSelectTab={setSelectedTab}
      orderTotal={120_000}
      selectedMethod={selectedMethod}
      selectedTab={selectedTab}
    />
  );
}

it('opens a payment category without preselecting an instrument', () => {
  render(<UnselectedPaymentSelector />);

  expect(screen.queryByText('Pay with Card')).toBeNull();
  for (const option of screen.getAllByRole('radio')) {
    expect(option.props.accessibilityState.checked).toBe(false);
  }

  fireEvent.press(screen.getByRole('radio', { name: /Pay in Full/ }));

  const cardMethod = screen.getByRole('radio', { name: /Pay with Card/ });
  expect(cardMethod.props.accessibilityState.checked).toBe(false);

  fireEvent.press(cardMethod);
  expect(
    screen.getByRole('radio', { name: /Pay with Card/ }).props
      .accessibilityState.checked
  ).toBe(true);
});

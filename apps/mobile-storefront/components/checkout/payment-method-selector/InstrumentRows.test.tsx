import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import Colors from '@/constants/Colors';
import { InstrumentRows } from './InstrumentRows';
import type { PaymentMethod, PaymentMethodType } from './types';

jest.mock('expo-image', () => ({ Image: () => null }));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'dark',
}));

const colors = Colors.dark;

function method(
  over: Partial<PaymentMethod> & { id: PaymentMethodType }
): PaymentMethod {
  return {
    label: 'Pay with Card',
    description: 'Visa, Mastercard, Verve',
    icon: 'card-outline',
    tab: 'full',
    ...over,
  };
}

function renderRows(
  props: Partial<ComponentProps<typeof InstrumentRows>> = {}
) {
  const onSelectMethod = props.onSelectMethod ?? jest.fn();
  render(
    <InstrumentRows
      colors={colors}
      methods={props.methods ?? [method({ id: 'paystack' })]}
      methodBadgeOverrides={props.methodBadgeOverrides ?? {}}
      methodDescriptionOverrides={props.methodDescriptionOverrides ?? {}}
      methodLabelOverrides={props.methodLabelOverrides ?? {}}
      onSelectMethod={onSelectMethod}
      savingsSuppressesGateway={props.savingsSuppressesGateway ?? false}
      selectedMethod={props.selectedMethod ?? 'paystack'}
      suppressedSelectedMethods={props.suppressedSelectedMethods ?? []}
      walletSuppressesGateway={props.walletSuppressesGateway ?? false}
    />
  );
  return { onSelectMethod };
}

describe('InstrumentRows', () => {
  it('renders a row per method and marks the selected one', () => {
    renderRows({
      methods: [
        method({ id: 'paystack' }),
        method({
          id: 'bank_transfer',
          label: 'Bank Transfer',
          description: 'Pay by transfer',
        }),
      ],
      selectedMethod: 'paystack',
    });

    const card = screen.getByRole('radio', { name: /Pay with Card/ });
    expect(card.props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByText('Bank Transfer')).toBeTruthy();
  });

  it('disables and deselects gateway rows while wallet fully covers the order', () => {
    renderRows({ selectedMethod: 'paystack', walletSuppressesGateway: true });

    const card = screen.getByRole('radio', { name: /Pay with Card/ });
    expect(card.props.accessibilityState).toMatchObject({
      checked: false,
      disabled: true,
    });
  });

  it('does not fire onSelectMethod for a caller-disabled method', () => {
    const { onSelectMethod } = renderRows({
      methods: [
        method({
          id: 'klump',
          label: 'Klump',
          description: 'BNPL',
          disabled: true,
          disabledReason: 'Minimum order: ₦10,000',
        }),
      ],
      selectedMethod: 'paystack',
    });

    fireEvent.press(screen.getByRole('radio', { name: /Klump/ }));
    expect(onSelectMethod).not.toHaveBeenCalled();
  });
});

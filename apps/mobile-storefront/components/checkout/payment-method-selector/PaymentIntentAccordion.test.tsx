import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Text } from 'react-native';
import Colors from '@/constants/Colors';
import { PaymentIntentAccordion } from './PaymentIntentAccordion';
import type { PaymentMethodType, PaymentTab } from './types';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const colors = Colors.dark;

interface Overrides {
  selectedTab?: PaymentTab;
  selectedMethod?: PaymentMethodType;
  hasBNPLMethods?: boolean;
  hasPayLaterMethods?: boolean;
  isBNPLEligible?: boolean;
  orderTotal?: number;
  onSelectIntent?: (...args: unknown[]) => void;
  nestedRows?: ReactNode;
  selectedInfo?: ReactNode;
}

function renderAccordion(overrides: Overrides = {}) {
  const onSelectIntent = overrides.onSelectIntent ?? jest.fn();

  render(
    <PaymentIntentAccordion
      colors={colors}
      selectedTab={overrides.selectedTab ?? 'full'}
      selectedMethod={overrides.selectedMethod ?? 'paystack'}
      hasBNPLMethods={overrides.hasBNPLMethods ?? true}
      hasPayLaterMethods={overrides.hasPayLaterMethods ?? true}
      isBNPLEligible={overrides.isBNPLEligible ?? true}
      orderTotal={overrides.orderTotal ?? 120000}
      onSelectIntent={onSelectIntent}
      nestedRows={overrides.nestedRows ?? null}
      selectedInfo={overrides.selectedInfo ?? null}
    />
  );

  return { onSelectIntent };
}

describe('PaymentIntentAccordion', () => {
  it('renders all four intents when every method group is available', () => {
    renderAccordion();

    expect(screen.getByText('Pay in Full')).toBeTruthy();
    expect(screen.getByText('Pay Small Small')).toBeTruthy();
    expect(screen.getByText('Pay for Me')).toBeTruthy();
    expect(screen.getByText('Generate Invoice')).toBeTruthy();
  });

  it('hides method groups the merchant has not enabled', () => {
    renderAccordion({ hasBNPLMethods: false, hasPayLaterMethods: false });

    expect(screen.getByText('Pay in Full')).toBeTruthy();
    expect(screen.queryByText('Pay Small Small')).toBeNull();
    expect(screen.queryByText('Pay for Me')).toBeNull();
    expect(screen.queryByText('Generate Invoice')).toBeNull();
  });

  it('emits the full intent (tab + pinned method) when an unselected intent is pressed', () => {
    const { onSelectIntent } = renderAccordion({
      selectedTab: 'full',
      selectedMethod: 'paystack',
    });

    fireEvent.press(screen.getByRole('radio', { name: /Pay for Me/ }));

    expect(onSelectIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'payforme',
        tab: 'pay_later',
        method: 'payforme',
      })
    );
  });

  it('toggles the selected card open/closed on re-tap without changing the selection', () => {
    const { onSelectIntent } = renderAccordion({
      selectedTab: 'full',
      selectedMethod: 'paystack',
      nestedRows: <Text>NESTED_INSTRUMENT</Text>,
    });

    // Open by default.
    expect(screen.getByText('NESTED_INSTRUMENT')).toBeTruthy();

    // Re-tap collapses it (options hidden) but never re-selects/deselects.
    fireEvent.press(screen.getByRole('radio', { name: /Pay in Full/ }));
    expect(screen.queryByText('NESTED_INSTRUMENT')).toBeNull();
    expect(onSelectIntent).not.toHaveBeenCalled();

    // Re-tap again re-opens it.
    fireEvent.press(screen.getByRole('radio', { name: /Pay in Full/ }));
    expect(screen.getByText('NESTED_INSTRUMENT')).toBeTruthy();
  });

  it('renders the selected-method info inside the open card', () => {
    renderAccordion({
      selectedTab: 'pay_later',
      selectedMethod: 'invoice',
      selectedInfo: <Text>SELECTED_METHOD_INFO</Text>,
    });

    expect(screen.getByText('SELECTED_METHOD_INFO')).toBeTruthy();
  });

  it('disables Pay Small Small below the BNPL floor and swaps in the eligibility hint', () => {
    const { onSelectIntent } = renderAccordion({
      selectedTab: 'full',
      selectedMethod: 'paystack',
      isBNPLEligible: false,
      orderTotal: 5000,
    });

    const card = screen.getByRole('radio', { name: /Pay Small Small/ });

    expect(card.props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByText('Available for orders from ₦10,000')).toBeTruthy();

    fireEvent.press(card);
    expect(onSelectIntent).not.toHaveBeenCalled();
  });

  it('renders nested instrument rows inside the expanded instrument-bearing intent', () => {
    renderAccordion({
      selectedTab: 'full',
      selectedMethod: 'paystack',
      nestedRows: <Text>NESTED_INSTRUMENT</Text>,
    });

    expect(screen.getByText('NESTED_INSTRUMENT')).toBeTruthy();
  });

  it('nests the instrument rows in their own radiogroup, not as peers of the intents', () => {
    renderAccordion({
      selectedTab: 'full',
      selectedMethod: 'paystack',
      nestedRows: <Text>NESTED_INSTRUMENT</Text>,
    });

    // The expanded card's instruments form a sub-group so a screen reader never
    // sees two checked radios inside the intent group.
    expect(screen.getByLabelText('Pay in Full options')).toBeTruthy();
  });

  it('does not render nested rows when a terminal pay_later intent is selected', () => {
    renderAccordion({
      selectedTab: 'pay_later',
      selectedMethod: 'invoice',
      nestedRows: <Text>NESTED_INSTRUMENT</Text>,
    });

    expect(screen.queryByText('NESTED_INSTRUMENT')).toBeNull();
  });
});

import { jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { PaymentMethodTabSelector } from './PaymentMethodTabSelector';

const baseProps = {
  colors: Colors.light,
  hasBNPLMethods: true,
  hasPayLaterMethods: true,
  onSelectTab: jest.fn(),
  selectedTab: 'full' as const,
};

describe('PaymentMethodTabSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps full tab labels in regular layouts', () => {
    render(<PaymentMethodTabSelector {...baseProps} />);

    expect(screen.getByText(/Pay\s+in full/)).toBeTruthy();
    expect(screen.getByText(/Pay\s+in Installments/)).toBeTruthy();
    expect(screen.getByText(/Pay\s+Later/)).toBeTruthy();
  });

  it('uses compact labels with readable accessible names', () => {
    render(<PaymentMethodTabSelector {...baseProps} compact />);

    expect(screen.getByText(/Pay\s+in full/)).toBeTruthy();
    expect(screen.getByText(/Pay\s+in Installments/)).toBeTruthy();
    expect(screen.getByText(/Pay\s+Later/)).toBeTruthy();
    expect(
      screen.getByRole('tab', { name: 'Pay in full' })
    ).toHaveAccessibilityState({ selected: true });
    expect(
      screen.getByRole('tab', { name: 'Pay in Installments' })
    ).toHaveAccessibilityState({ selected: false });
    expect(
      screen.getByRole('tab', { name: 'Pay Later' })
    ).toHaveAccessibilityState({ selected: false });
    expect(screen.getAllByTestId('payment-tab-separator')).toHaveLength(2);
  });

  it('omits unavailable optional tabs in compact layouts', () => {
    const { rerender } = render(
      <PaymentMethodTabSelector {...baseProps} compact hasBNPLMethods={false} />
    );

    expect(screen.getByRole('tab', { name: 'Pay in full' })).toBeTruthy();
    expect(screen.queryByText(/Pay\s+in Installments/)).toBeNull();
    expect(
      screen.queryByRole('tab', { name: 'Pay in Installments' })
    ).toBeNull();
    expect(screen.getByRole('tab', { name: 'Pay Later' })).toBeTruthy();
    expect(screen.getAllByTestId('payment-tab-separator')).toHaveLength(1);

    rerender(
      <PaymentMethodTabSelector
        {...baseProps}
        compact
        hasPayLaterMethods={false}
      />
    );

    expect(screen.getByRole('tab', { name: 'Pay in full' })).toBeTruthy();
    expect(
      screen.getByRole('tab', { name: 'Pay in Installments' })
    ).toBeTruthy();
    expect(screen.queryByText(/Pay\s+Later/)).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Pay Later' })).toBeNull();
    expect(screen.getAllByTestId('payment-tab-separator')).toHaveLength(1);
  });

  it('hides the selector when only full payment is available', () => {
    render(
      <PaymentMethodTabSelector
        {...baseProps}
        compact
        hasBNPLMethods={false}
        hasPayLaterMethods={false}
      />
    );

    expect(screen.queryByRole('tablist', { name: 'Payment type' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Pay in full' })).toBeNull();
  });

  it('switches tabs when pressed', () => {
    const onSelectTab = jest.fn();

    render(
      <PaymentMethodTabSelector {...baseProps} onSelectTab={onSelectTab} />
    );

    fireEvent.press(screen.getByRole('tab', { name: 'Pay Later' }));

    expect(onSelectTab).toHaveBeenCalledWith('pay_later');
  });
});

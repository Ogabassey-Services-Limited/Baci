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

    expect(screen.getByText('Full Payment')).toBeTruthy();
    expect(screen.getByText('Pay in Installments')).toBeTruthy();
    expect(screen.getByText('Pay Later')).toBeTruthy();
  });

  it('uses compact labels with readable accessible names', () => {
    render(<PaymentMethodTabSelector {...baseProps} compact />);

    const fullPaymentText = screen.getByText('Pay in\nFull');
    const installmentsText = screen.getByText('Pay in\nInstallments');

    expect(fullPaymentText).toBeTruthy();
    expect(installmentsText).toBeTruthy();
    expect(
      screen.getByRole('tab', { name: 'Pay in Full' })
    ).toHaveAccessibilityState({ selected: true });
    expect(
      screen.getByRole('tab', { name: 'Pay in Installments' })
    ).toHaveAccessibilityState({ selected: false });
    expect(
      screen.getByRole('tab', { name: 'Pay Later' })
    ).toHaveAccessibilityState({ selected: false });
    expect(fullPaymentText.props.numberOfLines).toBe(2);
    expect(fullPaymentText.props.adjustsFontSizeToFit).toBe(true);
  });

  it('omits unavailable optional tabs in compact layouts', () => {
    const { rerender } = render(
      <PaymentMethodTabSelector
        {...baseProps}
        compact
        hasBNPLMethods={false}
      />
    );

    expect(screen.getByRole('tab', { name: 'Pay in Full' })).toBeTruthy();
    expect(screen.queryByText(/Pay in\s+Installments/)).toBeNull();
    expect(
      screen.queryByRole('tab', { name: 'Pay in Installments' })
    ).toBeNull();
    expect(screen.getByRole('tab', { name: 'Pay Later' })).toBeTruthy();

    rerender(
      <PaymentMethodTabSelector
        {...baseProps}
        compact
        hasPayLaterMethods={false}
      />
    );

    expect(screen.getByRole('tab', { name: 'Pay in Full' })).toBeTruthy();
    expect(
      screen.getByRole('tab', { name: 'Pay in Installments' })
    ).toBeTruthy();
    expect(screen.queryByText('Pay Later')).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Pay Later' })).toBeNull();
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
    expect(screen.queryByRole('tab', { name: 'Pay in Full' })).toBeNull();
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

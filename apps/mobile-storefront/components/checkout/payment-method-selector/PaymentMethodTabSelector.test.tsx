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
    expect(fullPaymentText.props.children).toBe('Pay in\nFull');
    expect(installmentsText.props.children).toBe('Pay in\nInstallments');
    expect(screen.getByRole('tab', { name: 'Pay in full' })).toBeTruthy();
    expect(
      screen.getByRole('tab', { name: 'Pay in installments' })
    ).toBeTruthy();
    expect(fullPaymentText.props.numberOfLines).toBe(2);
    expect(fullPaymentText.props.adjustsFontSizeToFit).toBe(true);
  });

  it('switches tabs when pressed', () => {
    const onSelectTab = jest.fn();

    render(
      <PaymentMethodTabSelector {...baseProps} onSelectTab={onSelectTab} />
    );

    fireEvent.press(screen.getByRole('tab', { name: 'Pay later' }));

    expect(onSelectTab).toHaveBeenCalledWith('pay_later');
  });
});

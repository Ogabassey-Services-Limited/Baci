import { jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import ReceiptShareButton from './ReceiptShareButton';

jest.mock('@/hooks/use-receipts', () => ({
  useMerchantReceiptInfo: () => ({
    data: { business_name: 'Ogabassey', logo_url: 'https://cdn.test/logo.png' },
  }),
}));

// Render the preview modal as a simple text node exposing its props so we can
// assert it opens with the built receipt HTML (the real modal uses a WebView).
jest.mock('@/components/receipts/ReceiptPreviewModal', () => {
  const { Text } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    ReceiptPreviewModal: ({
      visible,
      html,
    }: {
      visible: boolean;
      html: string;
    }) => (visible ? <Text testID="receipt-preview">{html}</Text> : null),
  };
});

describe('ReceiptShareButton', () => {
  it('opens the receipt preview with the built HTML when pressed', () => {
    render(
      <ReceiptShareButton
        amount={1000}
        colors={Colors.light}
        identifier="08012345678"
        status="successful"
        txReference="VTU-123"
        type="airtime"
      />
    );

    expect(screen.queryByTestId('receipt-preview')).toBeNull();

    fireEvent.press(screen.getByLabelText('View utility receipt'));

    const preview = screen.getByTestId('receipt-preview');
    const html = String(preview.props.children);
    expect(html).toContain('Airtime Receipt');
    expect(html).toContain('08012345678');
    expect(html).toContain('VTU-123');
    expect(html).toContain('₦1,000');
  });

  it('renders the meter address on the receipt when provided', () => {
    render(
      <ReceiptShareButton
        address="5 Marina Road, Lagos"
        amount={2000}
        colors={Colors.light}
        identifier="43901766923"
        status="successful"
        txReference="VTU-PWR-1"
        type="power"
      />
    );

    fireEvent.press(screen.getByLabelText('View utility receipt'));

    const html = String(screen.getByTestId('receipt-preview').props.children);
    expect(html).toContain('Address');
    expect(html).toContain('5 Marina Road, Lagos');
  });

  it('is disabled and does not open the preview without a transaction reference', () => {
    render(
      <ReceiptShareButton
        amount={1000}
        colors={Colors.light}
        identifier="08012345678"
        status="successful"
        txReference={null}
        type="airtime"
      />
    );

    const button = screen.getByLabelText('View utility receipt');
    expect(button).toBeDisabled();

    fireEvent.press(button);
    expect(screen.queryByTestId('receipt-preview')).toBeNull();
  });
});

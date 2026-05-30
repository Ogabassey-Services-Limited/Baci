import { render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { WalletStatusRow } from './WalletStatusRow';

describe('WalletStatusRow', () => {
  it('renders a disabled balance-loading row', () => {
    render(<WalletStatusRow colors={Colors.light} isLoading={true} />);

    const row = screen.getByLabelText('Wallet. Checking wallet balance');

    expect(row.props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByText('Checking wallet balance')).toBeTruthy();
  });

  it('renders a disabled wallet-error row', () => {
    render(<WalletStatusRow colors={Colors.light} isLoading={false} />);

    expect(
      screen.getByLabelText(
        'Wallet unavailable. Use card while wallet refreshes'
      )
    ).toBeTruthy();
    expect(screen.getByText('Wallet unavailable')).toBeTruthy();
  });
});

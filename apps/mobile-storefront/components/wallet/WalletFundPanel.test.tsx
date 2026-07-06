import { jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { WalletFundPanel } from '@/components/wallet/WalletFundPanel';
import type { WalletDisplayFundingAccount } from '@/components/wallet/wallet.types';
import Colors from '@/constants/Colors';

const mockCopyToClipboard = jest.fn<() => Promise<void>>();

jest.mock('@/hooks/use-copy-to-clipboard', () => ({
  useCopyToClipboard: () => ({
    copyToClipboard: mockCopyToClipboard,
    feedback: null,
  }),
}));

const fundingAccount: WalletDisplayFundingAccount = {
  accountName: 'OGB / JOHN DOE',
  accountNumber: '9814644749',
  bankName: 'Wema Bank',
  provider: 'paystack',
};

function renderPanel(
  overrides: Partial<Parameters<typeof WalletFundPanel>[0]> = {}
) {
  const props = {
    canCreateFundingAccount: true,
    colors: Colors.light,
    fundAmount: '',
    fundingAccount,
    isCreatingFundingAccount: false,
    isFundPending: false,
    onChangeFundAmount: jest.fn(),
    onConfirmFund: jest.fn(),
    onCreateFundingAccount: jest.fn(),
    onResetFund: jest.fn(),
    ...overrides,
  };
  render(<WalletFundPanel {...props} />);
  return props;
}

describe('WalletFundPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('leads with the bank-transfer account number and fee note', () => {
    renderPanel();

    expect(screen.getByText('9814644749')).toBeTruthy();
    expect(screen.getByText('Wema Bank')).toBeTruthy();
    expect(screen.getByText(/1% fee, capped at ₦300/i)).toBeTruthy();
    // Card entry stays collapsed behind the toggle.
    expect(screen.queryByLabelText('Wallet top-up amount')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Fund with card instead' })
    ).toBeTruthy();
  });

  it('copies the account number', () => {
    renderPanel();

    fireEvent.press(
      screen.getByRole('button', { name: 'Copy wallet account number' })
    );

    expect(mockCopyToClipboard).toHaveBeenCalledWith('9814644749');
  });

  it('expands the card amount entry from the Fund with card toggle', () => {
    const props = renderPanel();

    fireEvent.press(
      screen.getByRole('button', { name: 'Fund with card instead' })
    );

    expect(screen.getByLabelText('Wallet top-up amount')).toBeTruthy();

    fireEvent.press(
      screen.getByRole('button', { name: 'Confirm wallet top-up' })
    );

    expect(props.onConfirmFund).toHaveBeenCalledTimes(1);
  });

  it('starts with card entry expanded when opened with a prefilled amount', () => {
    renderPanel({ fundAmount: '1000' });

    expect(screen.getByLabelText('Wallet top-up amount')).toBeTruthy();
  });

  it('auto-creates the funding account when none exists (Add Money = consent)', () => {
    const props = renderPanel({ fundingAccount: null });

    expect(props.onCreateFundingAccount).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/setting up your account number/i)).toBeTruthy();
  });

  it('falls back to card entry with the unavailable message when accounts are disabled', () => {
    const props = renderPanel({
      canCreateFundingAccount: false,
      createFundingAccountUnavailableMessage:
        'Bank transfer funding is not available for this store yet.',
      fundingAccount: null,
    });

    expect(props.onCreateFundingAccount).not.toHaveBeenCalled();
    expect(screen.getByText(/not available for this store yet/i)).toBeTruthy();
    expect(screen.getByLabelText('Wallet top-up amount')).toBeTruthy();
  });
});

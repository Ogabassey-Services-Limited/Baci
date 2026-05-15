import { IMEI_SERVICE_TIERS } from '@baci/shared/imei';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { ImeiCheckFormView } from './imei-check-form-view';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
  Stack: { Screen: () => null },
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: unknown }) => children,
}));

jest.mock('@/components/ui/AppKeyboardContainer', () => ({
  __esModule: true,
  default: ({ children }: { children: unknown }) => children,
}));

const baseProps = {
  colors: Colors.light,
  currentTier: IMEI_SERVICE_TIERS.full,
  displayedTierKeys: ['full', 'blacklist', 'carrier'] as const,
  error: null as string | null,
  imei: '',
  isLoading: false,
  isWalletError: false,
  isWalletLoading: false,
  selectedBrand: 'all' as const,
  selectedTier: 'full' as const,
  canToggleServices: true,
  showAllServices: false,
  walletBalance: 5000,
  onBrandSelect: jest.fn(),
  onChangeImei: jest.fn(),
  onCheck: jest.fn(),
  onClearImei: jest.fn(),
  onTierSelect: jest.fn(),
  onTopUpWallet: jest.fn(),
  onToggleServices: jest.fn(),
};

describe('ImeiCheckFormView', () => {
  it('renders the hero card and verify CTA with the current tier price', () => {
    render(<ImeiCheckFormView {...baseProps} />);

    expect(screen.getByText('IMEI Checker')).toBeTruthy();
    expect(screen.getByText('Device verification')).toBeTruthy();
    expect(screen.getByText('Verify Now - ₦1,500')).toBeTruthy();
  });

  it('disables the verify button when the IMEI is shorter than 15 digits', () => {
    const onCheck = jest.fn();
    render(<ImeiCheckFormView {...baseProps} imei="12345" onCheck={onCheck} />);

    const button = screen.getByText('Verify Now - ₦1,500').parent;
    expect(button).toBeTruthy();
    fireEvent.press(button as NonNullable<typeof button>);

    expect(onCheck).not.toHaveBeenCalled();
  });

  it('keeps the verify button disabled when the IMEI checksum is invalid', () => {
    const onCheck = jest.fn();
    render(
      <ImeiCheckFormView
        {...baseProps}
        imei="123456789012345"
        onCheck={onCheck}
      />
    );

    fireEvent.press(screen.getByText('Verify Now - ₦1,500'));

    expect(onCheck).not.toHaveBeenCalled();
  });

  it('invokes onCheck when verify is pressed with a valid IMEI', () => {
    const onCheck = jest.fn();
    render(
      <ImeiCheckFormView
        {...baseProps}
        imei="490154203237518"
        onCheck={onCheck}
      />
    );

    fireEvent.press(screen.getByText('Verify Now - ₦1,500'));

    expect(onCheck).toHaveBeenCalledTimes(1);
  });

  it('replaces the verify CTA with a loading indicator while a check is in flight', () => {
    render(
      <ImeiCheckFormView {...baseProps} imei="490154203237518" isLoading />
    );

    expect(screen.queryByText('Verify Now - ₦1,500')).toBeNull();
  });

  it('renders the top-up CTA and disables verify when wallet balance is short', () => {
    const onCheck = jest.fn();
    const onTopUpWallet = jest.fn();
    render(
      <ImeiCheckFormView
        {...baseProps}
        imei="490154203237518"
        walletBalance={500}
        onCheck={onCheck}
        onTopUpWallet={onTopUpWallet}
      />
    );

    expect(screen.getByText('Top up to unlock')).toBeTruthy();
    fireEvent.press(screen.getByText('Top up'));

    expect(onTopUpWallet).toHaveBeenCalledTimes(1);
    expect(onTopUpWallet).toHaveBeenCalledWith(1000);
    expect(onCheck).not.toHaveBeenCalled();
  });

  it('disables verify while the wallet balance is loading', () => {
    const onCheck = jest.fn();
    render(
      <ImeiCheckFormView
        {...baseProps}
        imei="490154203237518"
        isWalletLoading
        onCheck={onCheck}
      />
    );

    expect(screen.getByText('Loading wallet balance...')).toBeTruthy();
    fireEvent.press(screen.getByText('Loading wallet...'));

    expect(onCheck).not.toHaveBeenCalled();
  });

  it('disables verify when the wallet balance cannot be loaded', () => {
    const onCheck = jest.fn();
    render(
      <ImeiCheckFormView
        {...baseProps}
        imei="490154203237518"
        isWalletError
        onCheck={onCheck}
      />
    );

    expect(
      screen.getByText(
        'Wallet balance unavailable. Refresh your wallet and try again.'
      )
    ).toBeTruthy();
    fireEvent.press(screen.getByText('Wallet unavailable'));

    expect(onCheck).not.toHaveBeenCalled();
  });
});

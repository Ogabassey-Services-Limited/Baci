import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Alert, Linking } from 'react-native';

const mockDeleteAccount = jest.fn();
const mockRouterReplace = jest.fn();
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();

const mockUseRequireAuth = jest.fn(() => ({
  isLoading: false,
  redirectTo: null,
  user: {
    app_metadata: { provider: 'email', providers: ['email'] },
    identities: [],
  },
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: jest.fn(
    (selector: (state: { deleteAccount: typeof mockDeleteAccount }) => unknown) =>
      selector({ deleteAccount: mockDeleteAccount })
  ),
}));

jest.mock('@/hooks/use-auth-guard', () => ({
  useRequireAuth: () => mockUseRequireAuth(),
}));

jest.mock('@/components/ui/Toast', () => ({
  useToast: () => ({
    success: mockToastSuccess,
    error: mockToastError,
    Toast: () => null,
  }),
}));

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => `Redirect:${href}`,
  Stack: {
    Screen: () => null,
  },
  useRouter: () => ({
    replace: mockRouterReplace,
  }),
}));

import DeleteAccountScreen from './delete-account';

describe('DeleteAccountScreen', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockDeleteAccount.mockReset();
    mockRouterReplace.mockReset();
    mockToastSuccess.mockReset();
    mockToastError.mockReset();
    mockUseRequireAuth.mockReturnValue({
      isLoading: false,
      redirectTo: null,
      user: {
        app_metadata: { provider: 'email', providers: ['email'] },
        identities: [],
      },
    });
  });

  it('renders deletion warnings and retention copy', () => {
    render(<DeleteAccountScreen />);

    expect(screen.getByText('Delete your account')).toBeTruthy();
    expect(screen.getByText('What will be deleted now')).toBeTruthy();
    expect(screen.getByText('What we retain for compliance')).toBeTruthy();
  });

  it('requires confirmation before enabling delete button', () => {
    render(<DeleteAccountScreen />);

    const button = screen.getByTestId('delete-account-button');
    expect(button).toBeDisabled();

    fireEvent.press(screen.getByTestId('delete-account-confirm'));
    expect(button).not.toBeDisabled();
  });

  it('invokes account deletion after final confirmation', async () => {
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation(() => undefined);

    mockDeleteAccount.mockResolvedValue({ success: true, usedApple: false });

    render(<DeleteAccountScreen />);
    fireEvent.press(screen.getByTestId('delete-account-confirm'));
    fireEvent.press(screen.getByTestId('delete-account-button'));

    const promptButtons = alertSpy.mock.calls[0]?.[2] ?? [];
    const destructive = promptButtons.find(
      (button) => button?.style === 'destructive'
    );

    await act(async () => {
      await destructive?.onPress?.();
    });

    expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
    expect(mockRouterReplace).toHaveBeenCalledWith('/(tabs)');

    alertSpy.mockRestore();
  });

  it('shows Apple revoke guidance when user has Apple provider', () => {
    mockUseRequireAuth.mockReturnValue({
      isLoading: false,
      redirectTo: null,
      user: {
        app_metadata: { provider: 'apple', providers: ['apple'] },
        identities: [],
      },
    });

    render(<DeleteAccountScreen />);

    expect(screen.getByText('Signed in with Apple?')).toBeTruthy();
    expect(screen.getByText('Open Apple revoke guide')).toBeTruthy();
  });

  it('shows an error toast if opening Apple revoke link fails', async () => {
    mockUseRequireAuth.mockReturnValue({
      isLoading: false,
      redirectTo: null,
      user: {
        app_metadata: { provider: 'apple', providers: ['apple'] },
        identities: [],
      },
    });

    const canOpenUrlSpy = jest
      .spyOn(Linking, 'canOpenURL')
      .mockResolvedValue(true);
    const openUrlSpy = jest
      .spyOn(Linking, 'openURL')
      .mockRejectedValue(new Error('open failed'));

    render(<DeleteAccountScreen />);
    fireEvent.press(screen.getByText('Open Apple revoke guide'));

    await waitFor(() => {
      expect(canOpenUrlSpy).toHaveBeenCalledWith(
        'https://support.apple.com/en-us/HT210426'
      );
      expect(openUrlSpy).toHaveBeenCalledWith(
        'https://support.apple.com/en-us/HT210426'
      );
      expect(mockToastError).toHaveBeenCalledWith(
        'Unable to open Apple support link on this device.'
      );
    });
  });
});

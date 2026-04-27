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
    (
      selector: (state: { deleteAccount: typeof mockDeleteAccount }) => unknown
    ) => selector({ deleteAccount: mockDeleteAccount })
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

import DeleteAccountScreen from '@/app/profile/delete-account';

describe('DeleteAccountScreen', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
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

    const button = screen.getByRole('button', { name: 'Delete account' });
    expect(button).toBeDisabled();

    fireEvent.press(
      screen.getByRole('checkbox', {
        name: 'I understand this action is permanent',
      })
    );
    expect(button).not.toBeDisabled();
  });

  it('invokes account deletion after final confirmation', async () => {
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation(() => undefined);

    mockDeleteAccount.mockResolvedValue({ success: true, usedApple: false });

    render(<DeleteAccountScreen />);
    fireEvent.press(
      screen.getByRole('checkbox', {
        name: 'I understand this action is permanent',
      })
    );
    fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));

    // First alert: confirmation prompt
    const confirmButtons = alertSpy.mock.calls[0]?.[2] ?? [];
    const destructive = confirmButtons.find(
      (button) => button?.style === 'destructive'
    );

    await act(async () => {
      await destructive?.onPress?.();
    });

    expect(mockDeleteAccount).toHaveBeenCalledTimes(1);

    // Second alert: success message — router.replace is inside the OK callback
    const successButtons = alertSpy.mock.calls[1]?.[2] ?? [];
    const okButton = successButtons.find((button) => button?.text === 'OK');
    act(() => {
      okButton?.onPress?.();
    });

    expect(mockRouterReplace).toHaveBeenCalledWith('/');

    alertSpy.mockRestore();
  });

  it('shows error toast when deletion fails', async () => {
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation(() => undefined);

    mockDeleteAccount.mockResolvedValue({
      success: false,
      error: 'Unable to delete your account right now.',
      usedApple: false,
    });

    render(<DeleteAccountScreen />);
    fireEvent.press(
      screen.getByRole('checkbox', {
        name: 'I understand this action is permanent',
      })
    );
    fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));

    const confirmButtons = alertSpy.mock.calls[0]?.[2] ?? [];
    const destructive = confirmButtons.find(
      (button) => button?.style === 'destructive'
    );

    await act(async () => {
      await destructive?.onPress?.();
    });

    expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
    expect(mockToastError).toHaveBeenCalledWith(
      'Unable to delete your account right now.'
    );
    expect(mockRouterReplace).not.toHaveBeenCalled();

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
    expect(
      screen.getByRole('button', { name: 'Open Apple revoke guide' })
    ).toBeTruthy();
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
    fireEvent.press(
      screen.getByRole('button', { name: 'Open Apple revoke guide' })
    );

    await waitFor(() => {
      expect(canOpenUrlSpy).toHaveBeenCalledWith(
        'https://support.apple.com/en-us/102571'
      );
      expect(openUrlSpy).toHaveBeenCalledWith(
        'https://support.apple.com/en-us/102571'
      );
      expect(mockToastError).toHaveBeenCalledWith(
        'Unable to open Apple support link on this device.'
      );
    });
  });

  it('shows an error toast when Apple revoke URL cannot be opened on device', async () => {
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
      .mockResolvedValue(false);

    render(<DeleteAccountScreen />);
    fireEvent.press(
      screen.getByRole('button', { name: 'Open Apple revoke guide' })
    );

    await waitFor(() => {
      expect(canOpenUrlSpy).toHaveBeenCalledWith(
        'https://support.apple.com/en-us/102571'
      );
      expect(mockToastError).toHaveBeenCalledWith(
        'Unable to open Apple support link on this device.'
      );
    });
  });
});

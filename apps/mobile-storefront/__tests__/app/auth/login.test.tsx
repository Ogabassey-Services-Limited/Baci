import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import LoginScreen from '@/app/auth/login';

const mockAlert = jest.fn();
const mockBack = jest.fn();
const mockCanDismiss = jest.fn();
const mockDismiss = jest.fn();
const mockReplace = jest.fn();
const mockUseLocalSearchParams = jest.fn(() => ({}));
const mockSignInWithApple = jest.fn();
const mockSignInWithGoogle = jest.fn();
const mockSignInWithOtp = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockVerifyOtp = jest.fn();
const mockWithKeyboardDismiss = jest.fn(
  <T extends (...args: never[]) => unknown>(handler: T) => handler
);

const mockAuthState = {
  isInitialized: true,
  isLoading: false,
  signInWithApple: mockSignInWithApple,
  signInWithGoogle: mockSignInWithGoogle,
  signInWithOtp: mockSignInWithOtp,
  signInWithPassword: mockSignInWithPassword,
  user: null,
  verifyOtp: mockVerifyOtp,
};

jest.mock('expo-router', () => ({
  router: {
    back: mockBack,
    canDismiss: mockCanDismiss,
    dismiss: mockDismiss,
    replace: mockReplace,
  },
  Stack: {
    Screen: () => null,
  },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(async () => false),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({
    children,
    ...props
  }: {
    children?: ReactNode;
    [key: string]: unknown;
  }) => {
    const { View: MockView } =
      jest.requireActual<typeof import('react-native')>('react-native');

    return (
      <MockView testID="login-safe-area" {...props}>
        {children}
      </MockView>
    );
  },
}));

jest.mock('@/components/icons/GoogleLogo', () => ({
  GoogleLogo: () => null,
}));

jest.mock('@/components/ui/Logo', () => ({
  Logo: () => null,
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('@/hooks/use-keyboard', () => ({
  TextContentTypes: {
    emailAddress: 'emailAddress',
    oneTimeCode: 'oneTimeCode',
    password: 'password',
  },
  useKeyboard: () => ({
    withKeyboardDismiss: mockWithKeyboardDismiss,
  }),
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    error: jest.fn(),
    info: jest.fn(),
  }),
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (state: typeof mockAuthState) => unknown) =>
    selector(mockAuthState),
}));

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(mockAlert);
    mockAuthState.isInitialized = true;
    mockAuthState.isLoading = false;
    mockAuthState.user = null;
    mockCanDismiss.mockReturnValue(false);
    mockSignInWithApple.mockResolvedValue({ success: true });
    mockSignInWithGoogle.mockResolvedValue({ success: true });
    mockSignInWithOtp.mockResolvedValue({ success: true });
    mockSignInWithPassword.mockResolvedValue({ success: true });
    mockVerifyOtp.mockResolvedValue({ success: true });
    mockUseLocalSearchParams.mockReturnValue({});
  });

  it('renders the email login step inside safe-area and keyboard-aware wrappers', () => {
    render(<LoginScreen />);

    expect(screen.getByTestId('login-safe-area')).toBeOnTheScreen();
    expect(screen.getByTestId('keyboard-aware-scroll-view')).toHaveProp(
      'keyboardDismissMode',
      'on-drag'
    );
    expect(screen.getByTestId('keyboard-aware-scroll-view')).toHaveProp(
      'keyboardShouldPersistTaps',
      'handled'
    );
    expect(screen.getByText('Welcome Back')).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('john@example.com')).toBeOnTheScreen();
    expect(screen.getByText('Continue with Code')).toBeOnTheScreen();
    expect(screen.getByText('Google')).toBeOnTheScreen();
    expect(screen.getByText('Apple')).toBeOnTheScreen();
  });

  it('submits a normalized email through the OTP auth flow', async () => {
    render(<LoginScreen />);

    fireEvent.changeText(
      screen.getByPlaceholderText('john@example.com'),
      'Shopper@Example.COM '
    );
    fireEvent.press(screen.getByText('Continue with Code'));

    await waitFor(() => {
      expect(mockSignInWithOtp).toHaveBeenCalledWith('shopper@example.com');
    });
    expect(await screen.findByText('Verify Your Email')).toBeOnTheScreen();
    expect(mockWithKeyboardDismiss).toHaveBeenCalled();
  });

  it('surfaces OTP send failures without advancing to verification', async () => {
    mockSignInWithOtp.mockResolvedValueOnce({
      error: 'Email service unavailable',
      success: false,
    });
    render(<LoginScreen />);

    fireEvent.changeText(
      screen.getByPlaceholderText('john@example.com'),
      'shopper@example.com'
    );
    fireEvent.press(screen.getByText('Continue with Code'));

    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith(
        'Error',
        'Email service unavailable'
      );
    });
    expect(screen.queryByText('Verify Your Email')).toBeNull();
  });

  it('announces and toggles password visibility from the password step', async () => {
    render(<LoginScreen />);

    fireEvent.changeText(
      screen.getByPlaceholderText('john@example.com'),
      'shopper@example.com'
    );
    fireEvent.press(screen.getByText('Use password instead'));
    fireEvent.press(screen.getByText('Continue with Password'));

    expect(
      await screen.findByText(
        'Sign in with your password for shopper@example.com'
      )
    ).toBeOnTheScreen();

    const passwordInput = screen.getByPlaceholderText('••••••••');
    expect(passwordInput).toHaveProp('secureTextEntry', true);

    fireEvent.press(screen.getByRole('button', { name: 'Show password' }));

    expect(
      screen.getByRole('button', { name: 'Hide password' })
    ).toBeOnTheScreen();
    expect(passwordInput).toHaveProp('secureTextEntry', false);
  });
});

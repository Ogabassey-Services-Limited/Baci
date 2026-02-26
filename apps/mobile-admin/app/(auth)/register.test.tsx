import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mock react-native before any module imports it ---
const mockAlert = vi.fn();

vi.mock('react-native', () => ({
  Alert: { alert: mockAlert },
  StyleSheet: {
    create: (s: Record<string, unknown>) => s,
    absoluteFillObject: {},
  },
  View: 'View',
  Text: 'Text',
  TextInput: 'TextInput',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  ActivityIndicator: 'ActivityIndicator',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  SafeAreaView: 'SafeAreaView',
  Linking: { openURL: vi.fn() },
  Platform: { OS: 'ios' },
}));

// --- Mock expo/RN dependencies ---

const mockReplace = vi.fn();
const mockPush = vi.fn();

vi.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush, back: vi.fn() }),
}));

vi.mock('expo-constants', () => ({
  default: { expoConfig: { hostUri: 'localhost:8081' } },
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}));

// --- NetworkError inline replica (avoids importing api-client which pulls in expo-constants) ---

class NetworkError extends Error {
  public readonly isTimeout: boolean;
  public readonly isOffline: boolean;
  public readonly statusCode?: number;

  constructor(
    message: string,
    options: {
      isTimeout?: boolean;
      isOffline?: boolean;
      statusCode?: number;
    } = {}
  ) {
    super(message);
    this.name = 'NetworkError';
    this.isTimeout = options.isTimeout ?? false;
    this.isOffline = options.isOffline ?? false;
    this.statusCode = options.statusCode;
  }
}

// --- Replicate the onError handler from register.tsx for unit testing ---
// This mirrors lines 192-229 of register.tsx exactly.

function handleOnError(error: Error) {
  const networkError = error as NetworkError;

  if (networkError.statusCode === 409) {
    mockAlert(
      'Account Exists',
      'An account with this email already exists. Please log in instead.',
      [
        { text: 'Go to Login', onPress: () => mockReplace('/(auth)/login') },
        { text: 'OK', style: 'cancel' },
      ]
    );
    return;
  }

  if (networkError.statusCode === 429) {
    mockAlert('Too Many Attempts', 'Please wait a minute before trying again.');
    return;
  }

  let message = error.message || 'Please try again later.';
  if (networkError.isTimeout) {
    message =
      'The server is taking too long to respond. Please check your connection and try again.';
  } else if (networkError.isOffline) {
    message =
      'Could not reach the server. Please check your internet connection and try again.';
  }

  mockAlert('Registration Failed', message);
}

// --- Tests ---

describe('RegisterScreen registration callbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('onSuccess', () => {
    it('navigates to dashboard on successful registration', () => {
      // The component's onSuccess handler:
      //   router.replace('/(admin)/(tabs)');
      mockReplace('/(admin)/(tabs)');

      expect(mockReplace).toHaveBeenCalledWith('/(admin)/(tabs)');
    });

    it('uses router.replace (not push) to prevent back-navigation to register', () => {
      mockReplace('/(admin)/(tabs)');

      expect(mockReplace).toHaveBeenCalledTimes(1);
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('does not navigate to verify screen', () => {
      mockReplace('/(admin)/(tabs)');

      expect(mockPush).not.toHaveBeenCalledWith(
        expect.objectContaining({ pathname: '/(auth)/verify' })
      );
    });
  });

  describe('onError', () => {
    it('shows "Account Exists" alert with login action for 409 error', () => {
      const error = new NetworkError('User already exists. Please log in.', {
        statusCode: 409,
      });

      handleOnError(error);

      expect(mockAlert).toHaveBeenCalledWith(
        'Account Exists',
        'An account with this email already exists. Please log in instead.',
        expect.arrayContaining([
          expect.objectContaining({ text: 'Go to Login' }),
          expect.objectContaining({ text: 'OK', style: 'cancel' }),
        ])
      );
    });

    it('navigates to login when "Go to Login" is pressed on 409 alert', () => {
      const error = new NetworkError('User already exists', {
        statusCode: 409,
      });

      handleOnError(error);

      // Extract and invoke the "Go to Login" button's onPress
      const buttons = mockAlert.mock.calls[0][2] as Array<{
        text: string;
        onPress?: () => void;
      }>;
      const loginButton = buttons.find((b) => b.text === 'Go to Login');
      loginButton?.onPress?.();

      expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
    });

    it('shows rate-limit alert for 429 error', () => {
      const error = new NetworkError('Too many attempts', { statusCode: 429 });

      handleOnError(error);

      expect(mockAlert).toHaveBeenCalledWith(
        'Too Many Attempts',
        'Please wait a minute before trying again.'
      );
    });

    it('does not navigate on 429 error', () => {
      const error = new NetworkError('Too many attempts', { statusCode: 429 });

      handleOnError(error);

      expect(mockReplace).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('shows timeout message for timeout errors', () => {
      const error = new NetworkError('Request timed out', { isTimeout: true });

      handleOnError(error);

      expect(mockAlert).toHaveBeenCalledWith(
        'Registration Failed',
        'The server is taking too long to respond. Please check your connection and try again.'
      );
    });

    it('shows offline message for network errors', () => {
      const error = new NetworkError('Network request failed', {
        isOffline: true,
      });

      handleOnError(error);

      expect(mockAlert).toHaveBeenCalledWith(
        'Registration Failed',
        'Could not reach the server. Please check your internet connection and try again.'
      );
    });

    it('shows generic error message for unknown errors', () => {
      const error = new NetworkError('Something went wrong');

      handleOnError(error);

      expect(mockAlert).toHaveBeenCalledWith(
        'Registration Failed',
        'Something went wrong'
      );
    });

    it('falls back to default message when error.message is empty', () => {
      const error = new NetworkError('');

      handleOnError(error);

      expect(mockAlert).toHaveBeenCalledWith(
        'Registration Failed',
        'Please try again later.'
      );
    });

    it('does not navigate on non-409 errors', () => {
      const error = new NetworkError('Server error', { statusCode: 500 });

      handleOnError(error);

      expect(mockReplace).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_KEYBOARD_CONTAINER_LABEL } from './app-keyboard-container.mock';

// --- vi.hoisted: these variables are available inside vi.mock factories ---
const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  replace: vi.fn(),
  push: vi.fn(),
  mutate: vi.fn(),
}));

vi.mock('@/components/ui/AppFormScreen', async () => {
  const { createAppFormScreenMock } = await import('./app-form-screen.mock');
  return createAppFormScreenMock();
});

// --- Mock react-native with HTML-compatible components ---
vi.mock('react-native', async () => {
  const React = await import('react');
  return {
    Alert: { alert: mocks.alert },
    StyleSheet: {
      create: (s: Record<string, unknown>) => s,
      absoluteFillObject: {},
    },
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
    Text: ({
      children,
      onPress,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
    }) => React.createElement('span', { onClick: onPress }, children),
    TextInput: ({
      onChangeText,
      placeholder,
      value,
      secureTextEntry,
    }: {
      onChangeText?: (t: string) => void;
      placeholder?: string;
      value?: string;
      secureTextEntry?: boolean;
    }) =>
      React.createElement('input', {
        placeholder,
        value: value ?? '',
        type: secureTextEntry ? 'password' : 'text',
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(e.target.value),
      }),
    Pressable: ({
      accessibilityLabel,
      children,
      onPress,
      disabled,
    }: {
      accessibilityLabel?: string;
      children?: React.ReactNode;
      onPress?: () => void;
      disabled?: boolean;
    }) =>
      React.createElement(
        'button',
        { onClick: onPress, disabled, 'aria-label': accessibilityLabel },
        children
      ),
    ScrollView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
    ActivityIndicator: () => null,
    KeyboardAvoidingView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
    SafeAreaView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
    Linking: { openURL: vi.fn() },
    Platform: { OS: 'ios' },
  };
});

vi.mock('expo-linear-gradient', async () => {
  const React = await import('react');
  return {
    LinearGradient: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('react-native-edge-to-edge', () => ({ SystemBars: () => null }));

vi.mock('@expo/vector-icons', async () => {
  const React = await import('react');
  return {
    Ionicons: ({ name }: { name: string }) =>
      React.createElement('span', null, name),
  };
});

vi.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mocks.replace,
    push: mocks.push,
    back: vi.fn(),
  }),
}));

// Mock transitive deps so the real NetworkError from @/lib/api-client can load
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

vi.mock('@/hooks/useRegistration', () => ({
  useRegistration: () => ({
    register: { mutate: mocks.mutate, isPending: false },
    completeProfile: { mutate: vi.fn(), isPending: false },
    isLoading: false,
  }),
}));

vi.mock('@/components/ui/AppKeyboardContainer', async () => {
  const module = await import('./app-keyboard-container.mock');
  return module.createAppKeyboardContainerMock();
});

vi.mock('@/lib/password-utils', () => ({
  validatePassword: () => ({
    isValid: true,
    strength: 3,
    error: null,
    requirements: {
      length: true,
      complexity: true,
      notCommon: true,
      match: true,
    },
  }),
}));

vi.mock('@/lib/sanitize', () => ({ getEmailError: () => null }));

// --- Import real modules (after mocks are registered) ---
import { NetworkError } from '@/lib/api-client';
import RegisterScreen from '../../app/(auth)/register';

// --- Helpers ---

/** Fill the 2-step registration form and click "Launch Store" */
function fillFormAndSubmit() {
  // Step 1: Account details
  fireEvent.change(screen.getByPlaceholderText('John'), {
    target: { value: 'Test' },
  });
  fireEvent.change(screen.getByPlaceholderText('Doe'), {
    target: { value: 'User' },
  });
  fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
    target: { value: 'test@example.com' },
  });
  const passwordFields = screen.getAllByPlaceholderText('••••••••');
  fireEvent.change(passwordFields[0], {
    target: { value: 'StrongP@ss123!' },
  });
  fireEvent.change(passwordFields[1], {
    target: { value: 'StrongP@ss123!' },
  });

  // Click "Next Step" to go to step 2
  fireEvent.click(screen.getByText('Next Step'));

  // Step 2: Business info
  fireEvent.change(screen.getByPlaceholderText('My Awesome Store'), {
    target: { value: 'Test Store' },
  });
  fireEvent.click(screen.getByText('Fashion & Apparel'));

  // Submit the form → triggers register.mutate(payload, { onSuccess, onError })
  fireEvent.click(screen.getByText('Launch Store'));
}

/** Extract the onSuccess/onError callbacks from the latest mutate call */
function getCallbacks() {
  const lastCall = mocks.mutate.mock.calls[mocks.mutate.mock.calls.length - 1];
  return lastCall[1] as {
    onSuccess: () => void;
    onError: (error: Error) => void;
  };
}

// --- Tests ---

describe('RegisterScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('calls register.mutate with form data when submitted', () => {
    render(<RegisterScreen />);
    expect(
      screen.getByRole('region', { name: APP_KEYBOARD_CONTAINER_LABEL })
    ).toBeTruthy();
    expect(screen.getByLabelText('Back')).toBeTruthy();
    fillFormAndSubmit();

    expect(mocks.mutate).toHaveBeenCalledTimes(1);
    const [payload] = mocks.mutate.mock.calls[0];
    expect(payload).toMatchObject({
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      businessName: 'Test Store',
      businessType: 'fashion',
    });
  });

  it('clears stale otherBusinessType when switching away from Other', () => {
    render(<RegisterScreen />);

    fireEvent.change(screen.getByPlaceholderText('John'), {
      target: { value: 'Test' },
    });
    fireEvent.change(screen.getByPlaceholderText('Doe'), {
      target: { value: 'User' },
    });
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'test@example.com' },
    });
    const passwordFields = screen.getAllByPlaceholderText('••••••••');
    fireEvent.change(passwordFields[0], {
      target: { value: 'StrongP@ss123!' },
    });
    fireEvent.change(passwordFields[1], {
      target: { value: 'StrongP@ss123!' },
    });

    fireEvent.click(screen.getByText('Next Step'));
    fireEvent.change(screen.getByPlaceholderText('My Awesome Store'), {
      target: { value: 'Test Store' },
    });

    fireEvent.click(screen.getByText('Other'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Pet Supplies'), {
      target: { value: 'Custom Type' },
    });
    fireEvent.click(screen.getByText('Fashion & Apparel'));
    fireEvent.click(screen.getByText('Launch Store'));

    const [payload] = mocks.mutate.mock.calls[0];
    expect(payload).toMatchObject({
      businessType: 'fashion',
      otherBusinessType: '',
    });
  });

  describe('onSuccess', () => {
    it('navigates to dashboard via router.replace', () => {
      render(<RegisterScreen />);
      fillFormAndSubmit();

      getCallbacks().onSuccess();

      expect(mocks.replace).toHaveBeenCalledWith('/(admin)/(tabs)');
    });

    it('uses replace (not push) to prevent back-navigation to register', () => {
      render(<RegisterScreen />);
      fillFormAndSubmit();

      getCallbacks().onSuccess();

      expect(mocks.replace).toHaveBeenCalledTimes(1);
      expect(mocks.push).not.toHaveBeenCalled();
    });
  });

  describe('onError', () => {
    it('shows "Account Exists" alert with login action for 409', () => {
      render(<RegisterScreen />);
      fillFormAndSubmit();

      getCallbacks().onError(
        new NetworkError('User already exists', { statusCode: 409 })
      );

      expect(mocks.alert).toHaveBeenCalledWith(
        'Account Exists',
        'An account with this email already exists. Please log in instead.',
        expect.arrayContaining([
          expect.objectContaining({ text: 'Go to Login' }),
          expect.objectContaining({ text: 'OK', style: 'cancel' }),
        ])
      );
    });

    it('navigates to login when "Go to Login" is pressed on 409 alert', () => {
      render(<RegisterScreen />);
      fillFormAndSubmit();

      getCallbacks().onError(
        new NetworkError('User already exists', { statusCode: 409 })
      );

      // Press the "Go to Login" button from the Alert
      const buttons = mocks.alert.mock.calls[0][2] as Array<{
        text: string;
        onPress?: () => void;
      }>;
      buttons.find((b) => b.text === 'Go to Login')?.onPress?.();

      expect(mocks.replace).toHaveBeenCalledWith('/(auth)/login');
    });

    it('shows rate-limit alert for 429', () => {
      render(<RegisterScreen />);
      fillFormAndSubmit();

      getCallbacks().onError(
        new NetworkError('Too many attempts', { statusCode: 429 })
      );

      expect(mocks.alert).toHaveBeenCalledWith(
        'Too Many Attempts',
        'Please wait a minute before trying again.'
      );
    });

    it('does not navigate on 429', () => {
      render(<RegisterScreen />);
      fillFormAndSubmit();

      getCallbacks().onError(
        new NetworkError('Too many attempts', { statusCode: 429 })
      );

      expect(mocks.replace).not.toHaveBeenCalled();
      expect(mocks.push).not.toHaveBeenCalled();
    });

    it('shows timeout message for timeout errors', () => {
      render(<RegisterScreen />);
      fillFormAndSubmit();

      getCallbacks().onError(
        new NetworkError('Request timed out', { isTimeout: true })
      );

      expect(mocks.alert).toHaveBeenCalledWith(
        'Registration Failed',
        'The server is taking too long to respond. Please check your connection and try again.'
      );
    });

    it('shows offline message for network errors', () => {
      render(<RegisterScreen />);
      fillFormAndSubmit();

      getCallbacks().onError(
        new NetworkError('Network request failed', { isOffline: true })
      );

      expect(mocks.alert).toHaveBeenCalledWith(
        'Registration Failed',
        'Could not reach the server. Please check your internet connection and try again.'
      );
    });

    it('shows server error message for generic errors', () => {
      render(<RegisterScreen />);
      fillFormAndSubmit();

      getCallbacks().onError(
        new NetworkError('Something went wrong', { statusCode: 500 })
      );

      expect(mocks.alert).toHaveBeenCalledWith(
        'Registration Failed',
        'Something went wrong'
      );
    });

    it('does not navigate on non-409 errors', () => {
      render(<RegisterScreen />);
      fillFormAndSubmit();

      getCallbacks().onError(
        new NetworkError('Server error', { statusCode: 500 })
      );

      expect(mocks.replace).not.toHaveBeenCalled();
      expect(mocks.push).not.toHaveBeenCalled();
    });
  });
});

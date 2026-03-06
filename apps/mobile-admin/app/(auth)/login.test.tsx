import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  signIn: vi.fn(),
  resetOnboarding: vi.fn(),
  signInWithIdToken: vi.fn(),
  alert: vi.fn(),
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    Alert: { alert: mocks.alert },
    ActivityIndicator: () => React.createElement('span', null, 'loading'),
    KeyboardAvoidingView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
    Platform: { OS: 'web' },
    Pressable: ({
      children,
      onPress,
      disabled,
      accessibilityLabel,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
      disabled?: boolean;
      accessibilityLabel?: string;
    }) =>
      React.createElement(
        'button',
        { onClick: onPress, disabled, 'aria-label': accessibilityLabel },
        children
      ),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({
      children,
      style,
    }: {
      children?: React.ReactNode;
      style?: unknown;
    }) => React.createElement('span', { style }, children),
    TextInput: ({
      onChangeText,
      placeholder,
      value,
      secureTextEntry,
      editable = true,
    }: {
      onChangeText?: (text: string) => void;
      placeholder?: string;
      value?: string;
      secureTextEntry?: boolean;
      editable?: boolean;
    }) =>
      React.createElement('input', {
        placeholder,
        value: value ?? '',
        type: secureTextEntry ? 'password' : 'text',
        disabled: !editable,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
      }),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('react-native-safe-area-context', async () => {
  const React = await import('react');

  return {
    SafeAreaView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('react-native-edge-to-edge', () => ({
  SystemBars: () => null,
}));

vi.mock('react-native-svg', async () => {
  const React = await import('react');

  return {
    __esModule: true,
    default: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('svg', null, children),
    Path: () => React.createElement('path'),
  };
});

vi.mock('@expo/vector-icons', async () => {
  const React = await import('react');

  return {
    Ionicons: ({ name }: { name: string }) => React.createElement('span', null, name),
  };
});

vi.mock('expo-router', () => ({
  useRouter: () => ({
    push: mocks.push,
    replace: mocks.replace,
  }),
}));

vi.mock('expo-apple-authentication', () => ({
  AppleAuthenticationScope: {
    FULL_NAME: 'FULL_NAME',
    EMAIL: 'EMAIL',
  },
  signInAsync: vi.fn(),
}));

vi.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        googleIosClientId: 'ios-client-id',
        googleWebClientId: 'web-client-id',
      },
    },
  },
}));

vi.mock('@/components/BaciLogo', async () => {
  const React = await import('react');
  return {
    BaciLogo: () => React.createElement('div', null, 'BaciLogo'),
  };
});

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#ffffff',
      card: '#f5f5f5',
      border: '#d5d5d5',
      text: '#111111',
      textMuted: '#666666',
      textSecondary: '#555555',
      error: '#b00020',
      errorLight: '#f9d7dc',
    },
  }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    signIn: mocks.signIn,
  }),
}));

vi.mock('@/context/OnboardingContext', () => ({
  useOnboarding: () => ({
    resetOnboarding: mocks.resetOnboarding,
  }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithIdToken: mocks.signInWithIdToken,
    },
  },
}));

vi.mock('@/lib/sanitize', () => ({
  getEmailError: () => null,
}));

import LoginScreen from './login';

function fillLoginFields() {
  fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
    target: { value: 'merchant@example.com' },
  });
  fireEvent.change(screen.getByPlaceholderText('••••••••'), {
    target: { value: 'StrongP@ss123!' },
  });
}

describe('LoginScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.signIn.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    cleanup();
  });

  it('shows the sign-up prompt and link', () => {
    render(<LoginScreen />);

    expect(screen.getByText("Don't have an account?")).toBeTruthy();
    expect(screen.getByText('Sign Up')).toBeTruthy();
  });

  it('navigates to register when Sign Up is pressed', () => {
    render(<LoginScreen />);

    fireEvent.click(screen.getByText('Sign Up'));

    expect(mocks.push).toHaveBeenCalledWith('/(auth)/register');
  });

  it('navigates to forgot password when Forgot Password is pressed', () => {
    render(<LoginScreen />);

    fireEvent.click(screen.getByText('Forgot Password?'));

    expect(mocks.push).toHaveBeenCalledWith('/(auth)/forgot-password');
  });

  it('disables the sign-up link while sign-in is in progress', async () => {
    let resolveSignIn:
      | ((value: { error: null } | PromiseLike<{ error: null }>) => void)
      | undefined;
    const signInPromise = new Promise<{ error: null }>((resolve) => {
      resolveSignIn = resolve;
    });
    mocks.signIn.mockReturnValue(signInPromise);

    render(<LoginScreen />);
    fillLoginFields();
    fireEvent.click(screen.getByText('Sign In'));

    const signUpButton = screen.getByLabelText(
      'Sign up for a new merchant account'
    ) as HTMLButtonElement;

    await waitFor(() => {
      expect(signUpButton.disabled).toBe(true);
    });

    if (resolveSignIn) {
      resolveSignIn({ error: null });
    }
    await waitFor(() => {
      expect(signUpButton.disabled).toBe(false);
    });
  });
});

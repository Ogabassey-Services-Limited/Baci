import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ForgotPasswordScreen from './forgot-password';

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  back: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));

vi.mock('expo-linear-gradient', async () => {
  const React = await import('react');

  return {
    LinearGradient: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('expo-router', () => ({
  useRouter: () => ({
    back: mocks.back,
  }),
}));

vi.mock('react-native-edge-to-edge', () => ({
  SystemBars: () => null,
}));

vi.mock('react-native-safe-area-context', async () => {
  const React = await import('react');

  return {
    SafeAreaView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('@react-native-vector-icons/ionicons', async () => {
  const React = await import('react');

  return {
    __esModule: true,
    default: ({ name }: { name: string }) =>
      React.createElement('span', null, name),
  };
});

vi.mock('react-native', async () => {
  const React = await import('react');

  type AccessibilityState = {
    busy?: boolean;
    disabled?: boolean;
  };

  return {
    ActivityIndicator: () => React.createElement('span', null, 'loading'),
    Alert: { alert: mocks.alert },
    Pressable: ({
      accessibilityLabel,
      accessibilityRole,
      accessibilityState,
      children,
      disabled,
      onPress,
    }: {
      accessibilityLabel?: string;
      accessibilityRole?: string;
      accessibilityState?: AccessibilityState;
      children?: React.ReactNode;
      disabled?: boolean;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-busy': accessibilityState?.busy ? 'true' : undefined,
          'aria-disabled': accessibilityState?.disabled ? 'true' : undefined,
          'aria-label': accessibilityLabel,
          disabled,
          onClick: onPress,
          role: accessibilityRole,
        },
        children
      ),
    StyleSheet: {
      absoluteFill: {},
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    TextInput: ({
      onChangeText,
      onSubmitEditing,
      placeholder,
      value,
    }: {
      onChangeText?: (text: string) => void;
      onSubmitEditing?: () => void;
      placeholder?: string;
      value?: string;
    }) =>
      React.createElement('input', {
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
        onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
          if (event.key === 'Enter') {
            onSubmitEditing?.();
          }
        },
        placeholder,
        value: value ?? '',
      }),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#ffffff',
      backgroundLight: '#f8fafc',
      border: '#e5e7eb',
      cardHover: '#f1f5f9',
      inputBg: '#ffffff',
      placeholder: '#94a3b8',
      primary: '#2563eb',
      text: '#0f172a',
      textOnPrimary: '#ffffff',
      textSecondary: '#475569',
    },
    isDark: false,
  }),
}));

vi.mock('@/lib/sanitize', () => ({
  getEmailError: () => null,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: mocks.resetPasswordForEmail,
    },
  },
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

describe('ForgotPasswordScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    cleanup();
  });

  it('submits password reset from the keyboard done action', async () => {
    render(<ForgotPasswordScreen />);

    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'merchant@example.com' },
    });
    fireEvent.keyDown(screen.getByPlaceholderText('your@email.com'), {
      key: 'Enter',
    });

    await waitFor(() => {
      expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith(
        'merchant@example.com',
        { redirectTo: 'https://usebaci.com/update-password' }
      );
    });
  });

  it('exposes accessible button state while reset instructions are sending', async () => {
    const reset = createDeferred<{ error: null }>();
    mocks.resetPasswordForEmail.mockReturnValue(reset.promise);

    render(<ForgotPasswordScreen />);

    fireEvent.click(screen.getByLabelText('Back to login'));
    expect(mocks.back).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'merchant@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send Instructions' }));

    const sendingButton = await screen.findByRole('button', {
      name: 'Sending instructions...',
    });
    expect((sendingButton as HTMLButtonElement).disabled).toBe(true);
    expect(sendingButton.getAttribute('aria-busy')).toBe('true');
    expect(sendingButton.getAttribute('aria-disabled')).toBe('true');

    reset.resolve({ error: null });

    await waitFor(() => {
      expect(mocks.alert).toHaveBeenCalledWith(
        'Check your email',
        'We have sent a password reset link to merchant@example.com',
        expect.any(Array)
      );
    });
  });
});

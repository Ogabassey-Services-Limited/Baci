import '@testing-library/jest-dom/vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { KeyboardEvent, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  back: vi.fn(),
  replace: vi.fn(),
  verifyOtp: vi.fn(),
  resend: vi.fn(),
}));

interface TextInputHandle {
  focus: () => void;
}

interface TextInputProps {
  accessibilityLabel?: string;
  maxLength?: number;
  onChangeText?: (text: string) => void;
  onFocus?: () => void;
  onKeyPress?: (event: { nativeEvent: { key: string } }) => void;
  placeholder?: string;
  value?: string;
}

vi.mock('react-native', async () => {
  const React = await import('react');

  const TextInput = React.forwardRef<TextInputHandle, TextInputProps>(
    (
      {
        accessibilityLabel,
        maxLength,
        onChangeText,
        onFocus,
        onKeyPress,
        placeholder,
        value,
      },
      ref
    ) => {
      const inputRef = React.useRef<HTMLInputElement>(null);

      React.useImperativeHandle(ref, () => ({
        focus: () => inputRef.current?.focus(),
      }));

      return React.createElement('input', {
        'aria-label': accessibilityLabel,
        maxLength,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
        onFocus,
        onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
          onKeyPress?.({ nativeEvent: { key: event.key } });
        },
        placeholder,
        ref: inputRef,
        value: value ?? '',
      });
    }
  );
  TextInput.displayName = 'TextInputMock';

  return {
    ActivityIndicator: () => React.createElement('span', null, 'loading'),
    Alert: { alert: mocks.alert },
    Pressable: ({
      accessibilityLabel,
      children,
      disabled,
      onPress,
    }: {
      accessibilityLabel?: string;
      children?: ReactNode;
      disabled?: boolean;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        { 'aria-label': accessibilityLabel, disabled, onClick: onPress },
        children
      ),
    StatusBar: () => null,
    StyleSheet: {
      absoluteFill: {},
      create: (styles: Record<string, unknown>) => styles,
      hairlineWidth: 1,
    },
    Text: ({ children }: { children?: ReactNode }) =>
      React.createElement('span', null, children),
    TextInput,
    View: ({ children }: { children?: ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('react-native-safe-area-context', async () => {
  const React = await import('react');
  return {
    SafeAreaView: ({ children }: { children?: ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('expo-linear-gradient', async () => {
  const React = await import('react');
  return {
    LinearGradient: ({ children }: { children?: ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('@react-native-vector-icons/ionicons', async () => {
  const React = await import('react');
  return {
    Ionicons: ({ name }: { name: string }) =>
      React.createElement('span', null, name),
    __esModule: true,
    default: ({ name }: { name: string }) =>
      React.createElement('span', null, name),
  };
});

vi.mock('expo-router', async () => {
  const React = await import('react');
  return {
    Redirect: ({ href }: { href: string }) =>
      React.createElement('span', { 'data-href': href }, 'redirect'),
    useLocalSearchParams: () => ({ email: 'merchant@example.com' }),
    useRouter: () => ({
      back: mocks.back,
      replace: mocks.replace,
    }),
  };
});

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#ffffff',
      backgroundLight: '#f8fafc',
      border: '#d5d5d5',
      card: '#f5f5f5',
      inputBg: '#f8fafc',
      primary: '#2563eb',
      success: '#16a34a',
      text: '#111111',
      textMuted: '#666666',
      textOnPrimary: '#ffffff',
      textSecondary: '#555555',
    },
    isDark: false,
  }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      resend: mocks.resend,
      verifyOtp: mocks.verifyOtp,
    },
  },
}));

import VerifyScreen from './verify';

describe('VerifyScreen OTP keyboard controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyOtp.mockResolvedValue({ error: null });
    mocks.resend.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    cleanup();
  });

  it('labels every OTP digit and exposes cross-platform previous and next controls', () => {
    render(<VerifyScreen />);

    expect(screen.getByLabelText('Digit 1 of 6')).toBeInTheDocument();
    expect(screen.getByLabelText('Digit 6 of 6')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Previous code digit' })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Next code digit' })
    ).toBeInTheDocument();
  });

  it('advances OTP focus and submits with the Verify code control on the last digit', async () => {
    render(<VerifyScreen />);

    fireEvent.click(screen.getByRole('button', { name: 'Next code digit' }));
    expect(screen.getByLabelText('Digit 2 of 6')).toHaveFocus();

    for (const [index, digit] of ['1', '2', '3', '4', '5', '6'].entries()) {
      fireEvent.change(screen.getByLabelText(`Digit ${index + 1} of 6`), {
        target: { value: digit },
      });
    }

    expect(screen.getByLabelText('Digit 6 of 6')).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Verify code' }));

    await waitFor(() => {
      expect(mocks.verifyOtp).toHaveBeenCalledWith({
        email: 'merchant@example.com',
        token: '123456',
        type: 'signup',
      });
    });
  });
});

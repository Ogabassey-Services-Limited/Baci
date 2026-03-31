import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- vi.hoisted: these variables are available inside vi.mock factories ---
const mocks = vi.hoisted(() => ({
  signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
  verifyOtp: vi.fn().mockResolvedValue({ error: null }),
  resend: vi.fn().mockResolvedValue({ error: null }),
  alert: vi.fn(),
  back: vi.fn(),
  replace: vi.fn(),
  dismissAll: vi.fn(),
}));

// --- Mock react-native with HTML-compatible components ---
vi.mock('react-native', async () => {
  const React = await import('react');
  return {
    Alert: { alert: mocks.alert },
    StyleSheet: {
      create: (s: Record<string, unknown>) => s,
      absoluteFillObject: {},
      absoluteFill: {},
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
      onKeyPress,
    }: {
      onChangeText?: (t: string) => void;
      placeholder?: string;
      value?: string;
      onKeyPress?: (e: { nativeEvent: { key: string } }) => void;
    }) =>
      React.createElement('input', {
        placeholder,
        value: value ?? '',
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(e.target.value),
        onKeyDown: onKeyPress
          ? (e: React.KeyboardEvent) =>
              onKeyPress({ nativeEvent: { key: e.key } })
          : undefined,
      }),
    Pressable: ({
      children,
      onPress,
      disabled,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
      disabled?: boolean;
    }) =>
      React.createElement('button', { onClick: onPress, disabled }, children),
    ActivityIndicator: () => null,
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

vi.mock('react-native-safe-area-context', async () => {
  const React = await import('react');
  return {
    SafeAreaView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('@expo/vector-icons', async () => {
  const React = await import('react');
  return {
    Ionicons: ({ name }: { name: string }) =>
      React.createElement('span', null, name),
  };
});

vi.mock('expo-router', () => ({
  useRouter: () => ({
    back: mocks.back,
    replace: mocks.replace,
    dismissAll: mocks.dismissAll,
  }),
  useLocalSearchParams: () => ({ email: 'test@example.com' }),
  Redirect: () => null,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOtp: mocks.signInWithOtp,
      verifyOtp: mocks.verifyOtp,
      resend: mocks.resend,
    },
  },
}));

// --- Import component after mocks ---
import VerifyScreen from '@/app/(auth)/verify';

describe('VerifyScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('resend', () => {
    it('calls signInWithOtp with shouldCreateUser false', async () => {
      render(<VerifyScreen />);

      // Advance past the 30s initial timer
      act(() => {
        vi.advanceTimersByTime(31000);
      });

      // Find the resend button by its text content
      const resendButton = screen.getByText("I didn't receive a code");
      await act(async () => {
        fireEvent.click(resendButton);
      });

      expect(mocks.signInWithOtp).toHaveBeenCalledWith({
        email: 'test@example.com',
        options: { shouldCreateUser: false },
      });
      // Ensure the old resend method was NOT called
      expect(mocks.resend).not.toHaveBeenCalled();
    });

    it('shows success alert on success', async () => {
      mocks.signInWithOtp.mockResolvedValueOnce({ error: null });
      render(<VerifyScreen />);

      act(() => {
        vi.advanceTimersByTime(31000);
      });

      const resendButton = screen.getByText("I didn't receive a code");
      await act(async () => {
        fireEvent.click(resendButton);
      });

      expect(mocks.alert).toHaveBeenCalledWith(
        'Sent',
        'A new code has been sent to your email.'
      );
    });

    it('shows error alert on failure', async () => {
      mocks.signInWithOtp.mockRejectedValueOnce(
        new Error('Rate limit exceeded')
      );
      render(<VerifyScreen />);

      act(() => {
        vi.advanceTimersByTime(31000);
      });

      const resendButton = screen.getByText("I didn't receive a code");
      await act(async () => {
        fireEvent.click(resendButton);
      });

      expect(mocks.alert).toHaveBeenCalledWith('Error', 'Rate limit exceeded');
    });

    it('is blocked while timer > 0', async () => {
      render(<VerifyScreen />);

      // Do NOT advance timers, timer is still 30
      // The resend text should show countdown
      const countdownText = screen.getByText(/Resend code in/);
      expect(countdownText).toBeTruthy();

      // The button should exist and be disabled
      const resendButton = countdownText.closest('button');
      expect(resendButton).not.toBeNull();
      expect(resendButton?.disabled).toBe(true);

      // Clicking disabled button should not trigger resend
      await act(async () => {
        fireEvent.click(resendButton!);
      });

      expect(mocks.signInWithOtp).not.toHaveBeenCalled();
    });
  });

  describe('verify with fallback', () => {
    it('succeeds via email type fallback after signup type fails', async () => {
      // First verifyOtp call (type: 'signup') fails
      mocks.verifyOtp
        .mockRejectedValueOnce(new Error('Invalid OTP'))
        // Second verifyOtp call (type: 'email') succeeds
        .mockResolvedValueOnce({ error: null });

      render(<VerifyScreen />);

      // Enter 6-digit code into the OTP inputs
      const inputs = screen.getAllByPlaceholderText('-');
      expect(inputs.length).toBe(6);

      for (let i = 0; i < 6; i++) {
        fireEvent.change(inputs[i], { target: { value: String(i + 1) } });
      }

      // Click verify button
      const verifyButton = screen.getByText('Verify Email');
      await act(async () => {
        fireEvent.click(verifyButton);
      });

      // Verify both OTP types were tried
      expect(mocks.verifyOtp).toHaveBeenCalledWith({
        email: 'test@example.com',
        token: '123456',
        type: 'signup',
      });
      expect(mocks.verifyOtp).toHaveBeenCalledWith({
        email: 'test@example.com',
        token: '123456',
        type: 'email',
      });

      // Success overlay should be visible
      expect(screen.getByText('Verified!')).toBeTruthy();
    });
  });
});

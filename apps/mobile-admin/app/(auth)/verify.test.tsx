import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  back: vi.fn(),
  replace: vi.fn(),
  verifyOtp: vi.fn(),
  resend: vi.fn(),
  completeOnboarding: vi.fn(),
  finalizeOnboarding: vi.fn(),
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    Alert: { alert: mocks.alert },
    ActivityIndicator: () => React.createElement('span', null, 'loading'),
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
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
      absoluteFill: {},
      absoluteFillObject: {},
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    TextInput: ({
      onChangeText,
      placeholder,
      value,
    }: {
      onChangeText?: (text: string) => void;
      placeholder?: string;
      value?: string;
    }) =>
      React.createElement('input', {
        placeholder,
        value: value ?? '',
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
      }),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('expo-linear-gradient', async () => {
  const React = await import('react');
  return {
    LinearGradient: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

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

vi.mock('@expo/vector-icons', async () => {
  const React = await import('react');
  return {
    Ionicons: ({ name }: { name: string }) =>
      React.createElement('span', null, name),
  };
});

vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ email: 'merchant@example.com' }),
  useRouter: () => ({
    back: mocks.back,
    replace: mocks.replace,
  }),
  Redirect: ({ href }: { href: string }) => `redirect:${href}`,
}));

vi.mock('@/context/OnboardingContext', () => ({
  useOnboarding: () => ({
    completeOnboarding: mocks.completeOnboarding,
  }),
}));

vi.mock('@/hooks/useRegistration', () => ({
  useRegistration: () => ({
    finalizeOnboarding: { mutateAsync: mocks.finalizeOnboarding },
  }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      verifyOtp: mocks.verifyOtp,
      resend: mocks.resend,
    },
  },
}));

import VerifyScreen from './verify';

describe('VerifyScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyOtp.mockResolvedValue({ error: null });
    mocks.finalizeOnboarding.mockResolvedValue({ success: true });
    mocks.completeOnboarding.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it('finalizes onboarding and routes to the app root after a successful verification', async () => {
    render(<VerifyScreen />);

    for (const input of screen.getAllByPlaceholderText('-')) {
      fireEvent.change(input, { target: { value: '1' } });
    }

    fireEvent.click(screen.getByText('Verify Email'));

    await waitFor(() => {
      expect(mocks.verifyOtp).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(mocks.finalizeOnboarding).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(mocks.completeOnboarding).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByText('Verified!')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Enter Dashboard'));

    expect(mocks.replace).toHaveBeenCalledWith('/');
  });
});

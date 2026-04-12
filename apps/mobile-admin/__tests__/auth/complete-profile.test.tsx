import '@testing-library/jest-dom/vitest';
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
  mutate: vi.fn(),
  replace: vi.fn(),
  push: vi.fn(),
}));

vi.mock('@/components/ui/AppFormScreen', async () => {
  const { createAppFormScreenMock } = await import('./app-form-screen.mock');
  return createAppFormScreenMock();
});

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    ActivityIndicator: () => React.createElement('span', null, 'loading'),
    Alert: { alert: mocks.alert },
    Linking: { openURL: vi.fn() },
    Pressable: ({
      accessibilityLabel,
      children,
      disabled,
      onPress,
    }: {
      accessibilityLabel?: string;
      children?: React.ReactNode;
      disabled?: boolean;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        { 'aria-label': accessibilityLabel, disabled, onClick: onPress },
        children
      ),
    StyleSheet: {
      absoluteFillObject: {},
      create: (styles: Record<string, unknown>) => styles,
    },
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
  }),
}));

vi.mock('@/components/ui/SafeImage', async () => {
  const React = await import('react');
  return {
    default: () => React.createElement('div', null, 'SafeImage'),
  };
});

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#ffffff',
      border: '#d5d5d5',
      card: '#f5f5f5',
      inputBg: '#f8fafc',
      primary: '#2563eb',
      text: '#111111',
      textMuted: '#666666',
      textOnPrimary: '#ffffff',
      textSecondary: '#555555',
    },
    isDark: false,
  }),
}));

vi.mock('@/hooks/useRegistration', () => ({
  useRegistration: () => ({
    completeProfile: { mutate: mocks.mutate },
    isLoading: false,
  }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            email: 'merchant@example.com',
            user_metadata: {
              avatar_url: 'https://example.com/avatar.png',
              full_name: 'Akin John',
            },
          },
        },
      }),
    },
  },
}));

import CompleteProfileScreen from '../../app/(auth)/complete-profile';

async function waitForPrefill() {
  await waitFor(() => {
    expect(screen.getByDisplayValue('Akin John')).toBeInTheDocument();
  });
}

describe('CompleteProfileScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('submits the completed profile payload from the form', async () => {
    render(<CompleteProfileScreen />);
    await waitForPrefill();

    fireEvent.change(screen.getByPlaceholderText('John Doe'), {
      target: { value: 'Akin John' },
    });
    fireEvent.change(screen.getByPlaceholderText('My Awesome Store'), {
      target: { value: 'Akin Gadgets' },
    });
    fireEvent.click(screen.getByText('Electronics & Gadgets'));
    fireEvent.click(screen.getByRole('button', { name: 'Launch Store' }));

    expect(mocks.mutate).toHaveBeenCalledTimes(1);
    expect(mocks.mutate.mock.calls[0][0]).toMatchObject({
      businessName: 'Akin Gadgets',
      businessType: 'electronics',
      email: 'merchant@example.com',
      firstName: 'Akin',
      lastName: 'John',
    });
  });

  it('blocks submission when required fields are missing', async () => {
    render(<CompleteProfileScreen />);
    await waitForPrefill();

    fireEvent.change(screen.getByPlaceholderText('My Awesome Store'), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Launch Store' }));

    expect(mocks.mutate).not.toHaveBeenCalled();
    expect(mocks.alert).toHaveBeenCalledWith(
      'Error',
      'Please fill in all required fields (Name, Business Name, Type)'
    );
  });
});

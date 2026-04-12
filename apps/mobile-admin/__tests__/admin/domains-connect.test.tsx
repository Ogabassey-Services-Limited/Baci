import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_KEYBOARD_CONTAINER_LABEL } from '../auth/app-keyboard-container.mock';

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  dismissAll: vi.fn(),
  getSession: vi.fn(),
  push: vi.fn(),
}));

vi.mock('@/components/ui/AppFormScreen', async () => {
  const { createAppFormScreenMock } = await import(
    '../auth/app-form-screen.mock'
  );
  return createAppFormScreenMock();
});

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    ActivityIndicator: () => React.createElement('span', null, 'loading'),
    Alert: { alert: mocks.alert },
    Platform: { OS: 'web' },
    Pressable: ({
      children,
      onPress,
      disabled,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
      disabled?: boolean;
    }) =>
      React.createElement(
        'button',
        { disabled, onClick: () => onPress?.() },
        children
      ),
    ScrollView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    TextInput: ({
      value,
      onChangeText,
      placeholder,
    }: {
      value?: string;
      onChangeText?: (text: string) => void;
      placeholder?: string;
    }) =>
      React.createElement('input', {
        value: value ?? '',
        placeholder,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
      }),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('expo-router', () => ({
  useRouter: () => ({
    dismissAll: mocks.dismissAll,
    push: mocks.push,
  }),
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

vi.mock('expo-clipboard', () => ({
  setStringAsync: vi.fn(),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#020617',
      border: '#334155',
      card: '#111827',
      primary: '#3b82f6',
      success: '#16a34a',
      text: '#f8fafc',
      textSecondary: '#94a3b8',
    },
    shadows: {
      sm: {},
    },
  }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
    },
  },
}));

const fetchMock = vi.fn();

import ConnectDomainScreen from '@/app/(admin)/domains/connect';

describe('ConnectDomainScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'token',
        },
      },
    });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        domain: { domain: 'example.com' },
        verification: { value: 'verify-token' },
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the connect form inside the shared form shell', () => {
    render(<ConnectDomainScreen />);

    expect(
      screen.getByRole('region', { name: APP_KEYBOARD_CONTAINER_LABEL })
    ).toBeTruthy();
    expect(screen.getByText('Connect Existing Domain')).toBeTruthy();
    expect(screen.getByPlaceholderText('example.com')).toBeTruthy();
  });

  it('shows the verification step after a successful domain submission', async () => {
    render(<ConnectDomainScreen />);

    fireEvent.change(screen.getByPlaceholderText('example.com'), {
      target: { value: 'example.com' },
    });
    fireEvent.click(screen.getByText('Connect Domain'));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    expect(screen.getByText('Domain Added!')).toBeTruthy();
    expect(
      screen.getByText(/please add the following TXT record/i)
    ).toBeTruthy();
  });

  it('shows an error alert when the domain request fails', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Domain already exists' }),
    });

    render(<ConnectDomainScreen />);

    fireEvent.change(screen.getByPlaceholderText('example.com'), {
      target: { value: 'example.com' },
    });
    fireEvent.click(screen.getByText('Connect Domain'));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    expect(mocks.alert).toHaveBeenCalledWith('Error', 'Domain already exists');
  });
});

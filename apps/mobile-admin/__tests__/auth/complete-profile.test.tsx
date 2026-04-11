import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_KEYBOARD_CONTAINER_LABEL } from './app-keyboard-container.mock';

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  completeProfile: vi.fn(),
  openURL: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    ActivityIndicator: () => null,
    Alert: { alert: mocks.alert },
    Linking: { openURL: mocks.openURL },
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
      absoluteFillObject: {},
      create: (styles: Record<string, unknown>) => styles,
    },
    SafeAreaView: ({ children }: { children?: React.ReactNode }) =>
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

vi.mock('react-native-edge-to-edge', () => ({
  SystemBars: () => null,
}));

vi.mock('expo-linear-gradient', async () => {
  const React = await import('react');

  return {
    LinearGradient: ({ children }: { children?: React.ReactNode }) =>
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
    replace: mocks.replace,
  }),
}));

vi.mock('@/components/ui/AppKeyboardContainer', async () => {
  const module = await import('./app-keyboard-container.mock');
  return module.createAppKeyboardContainerMock();
});

vi.mock('@/components/ui/SafeImage', async () => {
  const React = await import('react');

  return {
    __esModule: true,
    default: () => React.createElement('img', { alt: 'safe image' }),
  };
});

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#ffffff',
      border: '#dddddd',
      card: '#f5f5f5',
      inputBg: '#f8f8f8',
      primary: '#1d4ed8',
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
    completeProfile: {
      mutate: mocks.completeProfile,
    },
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
              avatar_url: '',
              full_name: 'Jane Doe',
            },
          },
        },
      }),
    },
  },
}));

import CompleteProfileScreen from '../../app/(auth)/complete-profile';

describe('CompleteProfileScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders inside the shared keyboard container after initialization', async () => {
    render(<CompleteProfileScreen />);

    expect(
      await screen.findByRole('region', { name: APP_KEYBOARD_CONTAINER_LABEL })
    ).toBeTruthy();
    expect(screen.getByText('Complete Setup')).toBeTruthy();
  });

  it('submits the completed profile payload', async () => {
    render(<CompleteProfileScreen />);

    await screen.findByText('Launch Store');

    fireEvent.change(screen.getByPlaceholderText('John Doe'), {
      target: { value: 'Jane Doe' },
    });
    fireEvent.change(screen.getByPlaceholderText('My Awesome Store'), {
      target: { value: 'Jane Gadgets' },
    });
    fireEvent.click(screen.getByText('Electronics & Gadgets'));
    fireEvent.click(screen.getByText('Launch Store'));

    expect(mocks.completeProfile).toHaveBeenCalledTimes(1);
    expect(mocks.completeProfile.mock.calls[0][0]).toMatchObject({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'merchant@example.com',
      businessName: 'Jane Gadgets',
      businessType: 'electronics',
    });
  });

  it('shows an error alert when profile completion fails', async () => {
    mocks.completeProfile.mockImplementation((_payload, callbacks) => {
      callbacks?.onError?.(new Error('Network unavailable'));
    });

    render(<CompleteProfileScreen />);

    await screen.findByText('Launch Store');

    fireEvent.change(screen.getByPlaceholderText('John Doe'), {
      target: { value: 'Jane Doe' },
    });
    fireEvent.change(screen.getByPlaceholderText('My Awesome Store'), {
      target: { value: 'Jane Gadgets' },
    });
    fireEvent.click(screen.getByText('Electronics & Gadgets'));
    fireEvent.click(screen.getByText('Launch Store'));

    await waitFor(() => {
      expect(mocks.completeProfile).toHaveBeenCalledTimes(1);
      expect(mocks.alert).toHaveBeenCalledWith(
        'Setup Failed',
        'Network unavailable'
      );
    });
  });
});

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
  mutate: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
}));

interface TextInputHandle {
  focus: () => void;
}

interface TextInputProps {
  accessibilityLabel?: string;
  onChangeText?: (text: string) => void;
  onFocus?: () => void;
  onSubmitEditing?: () => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  value?: string;
}

vi.mock('@/components/ui/AppFormScreen', async () => {
  const { createAppFormScreenMock } = await import(
    '../../__tests__/auth/app-form-screen.mock'
  );
  return createAppFormScreenMock();
});

vi.mock('react-native', async () => {
  const React = await import('react');

  const TextInput = React.forwardRef<TextInputHandle, TextInputProps>(
    (
      {
        accessibilityLabel,
        onChangeText,
        onFocus,
        onSubmitEditing,
        placeholder,
        secureTextEntry,
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
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
        onFocus,
        onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key === 'Enter') {
            onSubmitEditing?.();
          }
        },
        placeholder,
        ref: inputRef,
        type: secureTextEntry ? 'password' : 'text',
        value: value ?? '',
      });
    }
  );
  TextInput.displayName = 'TextInputMock';

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
      absoluteFillObject: {},
      create: (styles: Record<string, unknown>) => styles,
      hairlineWidth: 1,
    },
    Text: ({
      children,
      onPress,
    }: {
      children?: ReactNode;
      onPress?: () => void;
    }) => React.createElement('span', { onClick: onPress }, children),
    TextInput,
    View: ({ children }: { children?: ReactNode }) =>
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

vi.mock('expo-router', () => ({
  useRouter: () => ({
    push: mocks.push,
    replace: mocks.replace,
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

import CompleteProfileScreen from './complete-profile';

async function waitForPrefill() {
  await waitFor(() => {
    expect(screen.getByDisplayValue('Akin John')).toBeInTheDocument();
  });
}

describe('CompleteProfileScreen keyboard navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('uses a visible cross-platform next control to focus the business name field', async () => {
    render(<CompleteProfileScreen />);
    await waitForPrefill();

    fireEvent.click(screen.getByRole('button', { name: 'Next field' }));

    expect(screen.getByLabelText('Business Name')).toHaveFocus();
  });

  it('does not submit the form from the Store Link return key before business type is selected', async () => {
    render(<CompleteProfileScreen />);
    await waitForPrefill();

    fireEvent.keyDown(screen.getByLabelText('Store Link'), { key: 'Enter' });

    expect(mocks.mutate).not.toHaveBeenCalled();
    expect(mocks.alert).not.toHaveBeenCalled();
  });
});

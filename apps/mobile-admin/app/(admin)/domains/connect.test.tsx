import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import ConnectDomainScreen from './connect';

const mocks = vi.hoisted(() => ({
  formScreenProps: {
    keyboardOffsetPreset: 'default' as 'default' | 'compactHeader',
  },
  router: {
    dismissAll: vi.fn(),
    push: vi.fn(),
  },
}));

vi.mock('expo-router', async () => {
  const React = await import('react');
  return {
    useRouter: () => mocks.router,
    Stack: Object.assign(
      ({ children }: { children?: React.ReactNode }) => children,
      {
        Screen: () => React.createElement('div', null),
      }
    ),
  };
});

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#ffffff',
      border: '#e2e8f0',
      card: '#f8fafc',
      primary: '#2563eb',
      success: '#16a34a',
      text: '#0f172a',
      textSecondary: '#334155',
    },
    shadows: { sm: {} },
  }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock('@/components/ui/AppFormScreen', () => ({
  AppFormScreen: ({
    children,
    keyboardOffsetPreset,
  }: {
    children?: ReactNode;
    keyboardOffsetPreset?: 'default' | 'compactHeader';
  }) => {
    mocks.formScreenProps.keyboardOffsetPreset = keyboardOffsetPreset ?? 'default';
    return <section aria-label="connect-domain-form">{children}</section>;
  },
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => <span>icon</span>,
}));

vi.mock('react-native', () => ({
  ActivityIndicator: () => <span>loading</span>,
  Alert: { alert: vi.fn() },
  Platform: { OS: 'web' },
  Pressable: ({
    accessibilityLabel,
    children,
    onPress,
  }: {
    accessibilityLabel?: string;
    children?: ReactNode;
    onPress?: () => void;
  }) => (
    <button aria-label={accessibilityLabel} onClick={() => onPress?.()} type="button">
      {children}
    </button>
  ),
  ScrollView: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  TextInput: ({
    onChangeText,
    placeholder,
    value,
  }: {
    onChangeText?: (value: string) => void;
    placeholder?: string;
    value?: string;
  }) => (
    <input
      onChange={(event) => onChangeText?.(event.target.value)}
      placeholder={placeholder}
      value={value}
    />
  ),
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

describe('ConnectDomainScreen', () => {
  it('uses compact keyboard offset preset for the form shell', () => {
    render(<ConnectDomainScreen />);

    expect(screen.getByLabelText('connect-domain-form')).toBeInTheDocument();
    expect(mocks.formScreenProps.keyboardOffsetPreset).toBe('compactHeader');
  });

  it('renders the domain field and submit action', () => {
    render(<ConnectDomainScreen />);

    expect(screen.getByText('Connect Existing Domain')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('example.com')).toBeInTheDocument();
    expect(screen.getByText('Connect Domain')).toBeInTheDocument();
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AddDomainScreen from './add';

const mocks = vi.hoisted(() => ({
  router: {
    push: vi.fn(),
  },
}));

vi.mock('expo-router', () => ({
  useRouter: () => mocks.router,
}));

vi.mock('@react-native-vector-icons/ionicons', () => ({
  default: ({ name }: { name?: string }) => (
    <span aria-hidden="true" data-icon={name} />
  ),
  __esModule: true,
}));

vi.mock('react-native', () => ({
  Pressable: ({
    children,
    onPress,
  }: {
    children?: ReactNode;
    onPress?: () => void;
  }) => (
    <button onClick={() => onPress?.()} type="button">
      {children}
    </button>
  ),
  ScrollView: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/billing/FeatureGateScreen', () => ({
  FeatureGateScreen: ({ children }: { children?: ReactNode }) => children,
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#ffffff',
      card: '#f8fafc',
      primary: '#2563eb',
      text: '#0f172a',
      textSecondary: '#475569',
      warning: '#f59e0b',
    },
    shadows: { sm: {} },
  }),
}));

describe('AddDomainScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders both domain setup choices', () => {
    render(<AddDomainScreen />);

    expect(screen.getByText('Choose how you want to proceed')).toBeTruthy();
    expect(screen.getByText('Get a custom domain')).toBeTruthy();
    expect(screen.getByText('Connect to a domain')).toBeTruthy();
  });

  it('routes to the selected domain setup flow', () => {
    render(<AddDomainScreen />);

    fireEvent.click(
      screen.getByRole('button', { name: /Get a custom domain/i })
    );

    expect(mocks.router.push).toHaveBeenCalledWith('/domains/buy');
  });
});

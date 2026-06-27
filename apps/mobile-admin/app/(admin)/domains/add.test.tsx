import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AddDomainScreen from './add';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock('react-native', async () => {
  const React = await import('react');
  return {
    Pressable: ({
      children,
      onPress,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
    }) =>
      React.createElement('button', { onClick: () => onPress?.() }, children),
    ScrollView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
    StyleSheet: { create: (styles: Record<string, unknown>) => styles },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,
  default: () => null,
  __esModule: true,
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      card: '#fff',
      primary: '#2563eb',
      text: '#111827',
      textSecondary: '#4b5563',
      warning: '#d97706',
    },
    shadows: { sm: {} },
  }),
}));

describe('AddDomainScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders domain setup options and routes to buying a domain', () => {
    render(<AddDomainScreen />);

    expect(screen.getByText('Choose how you want to proceed')).toBeTruthy();
    expect(screen.getByText('Get a custom domain')).toBeTruthy();
    expect(screen.getByText('Connect to a domain')).toBeTruthy();

    fireEvent.click(screen.getByText('Get a custom domain'));

    expect(mocks.push).toHaveBeenCalledWith('/domains/buy');
  });
});

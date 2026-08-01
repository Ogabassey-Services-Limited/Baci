import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import SettingsListItem from './SettingsListItem';

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: ({ name }: { name?: string }) => <span>{name}</span>,
  default: ({ name }: { name?: string }) => <span>{name}</span>,
  __esModule: true,
}));

vi.mock('react-native', () => ({
  Pressable: ({
    accessibilityLabel,
    children,
    onPress,
  }: {
    accessibilityLabel?: string;
    children?: ReactNode;
    onPress?: () => void;
  }) => (
    <button aria-label={accessibilityLabel} onClick={onPress} type="button">
      {children}
    </button>
  ),
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
  Switch: ({ value }: { value: boolean }) => (
    <span>{value ? 'enabled' : 'disabled'}</span>
  ),
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#e5e7eb',
      primary: '#3b82f6',
      text: '#111827',
      textSecondary: '#6b7280',
    },
  }),
}));

describe('SettingsListItem', () => {
  it('opens the supplied destination from an accessible setting row', () => {
    const onPress = vi.fn();

    render(
      <SettingsListItem
        icon="shield-checkmark-outline"
        onPress={onPress}
        subtitle="Password, 2FA"
        title="Security"
      />
    );

    const item = screen.getByRole('button', {
      name: 'Security, Password, 2FA',
    });

    fireEvent.click(item);

    expect(onPress).toHaveBeenCalledOnce();
    expect(screen.getByText('chevron-forward')).toBeInTheDocument();
  });

  it('renders a toggle in place of the navigation arrow', () => {
    render(
      <SettingsListItem
        icon="notifications-outline"
        title="Push Notifications"
        toggle={true}
      />
    );

    expect(screen.getByText('enabled')).toBeInTheDocument();
    expect(screen.queryByText('chevron-forward')).toBeNull();
  });
});

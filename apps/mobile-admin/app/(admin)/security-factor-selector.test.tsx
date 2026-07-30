import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SecurityFactorSelector } from './security-factor-selector';

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      border: '#ddd',
      primary: '#900',
      text: '#111',
    },
  }),
}));

vi.mock('react-native', () => ({
  Pressable: ({
    accessibilityLabel,
    accessibilityRole,
    accessibilityState,
    children,
    onPress,
  }: {
    accessibilityLabel?: string;
    accessibilityRole?: 'radio';
    accessibilityState?: { checked?: boolean };
    children?: ReactNode;
    onPress?: () => void;
  }) => (
    <button
      aria-label={accessibilityLabel}
      onClick={onPress}
      {...(accessibilityRole === 'radio'
        ? {
            'aria-checked': accessibilityState?.checked ?? false,
            role: 'radio',
          }
        : {})}
      type="button"
    >
      {children}
    </button>
  ),
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({
    accessibilityRole,
    children,
  }: {
    accessibilityRole?: 'radiogroup';
    children?: ReactNode;
  }) => <div role={accessibilityRole}>{children}</div>,
}));

describe('SecurityFactorSelector', () => {
  it('selects a named backup authenticator', () => {
    const onSelect = vi.fn();

    render(
      <SecurityFactorSelector
        factors={[
          { id: 'primary', name: 'Primary authenticator' },
          { id: 'backup', name: 'Backup authenticator' },
        ]}
        onSelect={onSelect}
        selectedFactorId="primary"
      />
    );

    fireEvent.click(
      screen.getByRole('radio', { name: 'Use Backup authenticator' })
    );

    expect(onSelect).toHaveBeenCalledWith('backup');
  });
});

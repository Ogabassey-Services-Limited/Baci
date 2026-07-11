import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

function flattenStyle(
  style: Record<string, unknown> | Record<string, unknown>[] | undefined
): Record<string, unknown> {
  if (Array.isArray(style)) {
    const accumulator: Record<string, unknown> = {};
    for (const value of style) {
      Object.assign(accumulator, flattenStyle(value));
    }
    return accumulator;
  }
  return style ?? {};
}

vi.mock('react-native', () => ({
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: ({
    children,
    style,
  }: {
    children?: ReactNode;
    style?: Record<string, unknown> | Record<string, unknown>[];
  }) => {
    const flat = flattenStyle(style);
    return <span style={{ color: flat.color as string }}>{children}</span>;
  },
  View: ({
    children,
    style,
  }: {
    children?: ReactNode;
    style?: Record<string, unknown> | Record<string, unknown>[];
  }) => {
    const flat = flattenStyle(style);
    return (
      <div style={{ backgroundColor: flat.backgroundColor as string }}>
        {children}
      </div>
    );
  },
}));

import { RepairStatusBadge } from './RepairStatusBadge';

const colors = {
  border: '#E2E8F0',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  info: '#3B82F6',
  infoLight: '#DBEAFE',
  primary: '#4A90D9',
  primaryLight: '#E3EFFC',
  success: '#22C55E',
  successLight: '#DCFCE7',
  textMuted: '#6B7280',
  textSecondary: '#9CA3AF',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
} as unknown as Parameters<typeof RepairStatusBadge>[0]['colors'];

describe('RepairStatusBadge', () => {
  it('renders the human label for a pending booking', () => {
    render(<RepairStatusBadge colors={colors} status="pending" />);

    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('renders the human label for a completed booking', () => {
    render(<RepairStatusBadge colors={colors} status="completed" />);

    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('colors a rejected badge with the error palette', () => {
    render(<RepairStatusBadge colors={colors} status="rejected" />);

    const label = screen.getByText('Rejected');
    expect(label).toHaveStyle({ color: colors.error });
  });
});

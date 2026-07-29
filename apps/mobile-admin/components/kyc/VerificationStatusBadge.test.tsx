import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import VerificationStatusBadge from './VerificationStatusBadge';

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      inputBg: '#252542',
      success: '#22c55e',
      successLight: '#052e16',
      textMuted: '#94a3b8',
      warning: '#f59e0b',
      warningLight: '#451a03',
    },
  }),
}));

vi.mock('@react-native-vector-icons/ionicons', () => ({
  default: ({ color, name }: { color: string; name: string }) => (
    <span data-color={color}>{name}</span>
  ),
}));

vi.mock('react-native', () => ({
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({
    accessibilityLabel,
    children,
    style,
  }: {
    accessibilityLabel?: string;
    children?: ReactNode;
    style?: Record<string, unknown>[];
  }) => (
    <section
      aria-label={accessibilityLabel}
      style={Object.assign({}, ...(style ?? []))}
    >
      {children}
    </section>
  ),
}));

describe('VerificationStatusBadge', () => {
  it('renders the default not-started state without a progress icon', () => {
    render(<VerificationStatusBadge status="not-started" />);

    expect(screen.getByLabelText('Not Started')).toHaveStyle({
      backgroundColor: '#252542',
    });
    expect(screen.queryByText('time-outline')).not.toBeInTheDocument();
    expect(screen.queryByText('checkmark-circle')).not.toBeInTheDocument();
  });

  it('renders the default pending state with its warning icon and color', () => {
    render(<VerificationStatusBadge status="pending" />);

    expect(screen.getByLabelText('Pending')).toHaveStyle({
      backgroundColor: '#451a03',
    });
    expect(screen.getByText('time-outline')).toHaveAttribute(
      'data-color',
      '#f59e0b'
    );
  });

  it('renders the default verified state with its success icon and color', () => {
    render(<VerificationStatusBadge status="verified" />);

    expect(screen.getByLabelText('Verified')).toHaveStyle({
      backgroundColor: '#052e16',
    });
    expect(screen.getByText('checkmark-circle')).toHaveAttribute(
      'data-color',
      '#22c55e'
    );
  });

  it('overrides the label while preserving pending styling and icon', () => {
    render(<VerificationStatusBadge label="BVN Pending" status="pending" />);

    expect(screen.getByLabelText('BVN Pending')).toHaveTextContent(
      'BVN Pending'
    );
    expect(screen.getByLabelText('BVN Pending')).toHaveStyle({
      backgroundColor: '#451a03',
    });
    expect(screen.getByText('time-outline')).toHaveAttribute(
      'data-color',
      '#f59e0b'
    );
  });
});

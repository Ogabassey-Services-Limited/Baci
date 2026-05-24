import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ExpenseBranchSelector } from '@/components/expenses/ExpenseBranchSelector';

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      border: '#334155',
      card: '#111827',
      primary: '#3b82f6',
      text: '#f8fafc',
      textSecondary: '#cbd5e1',
    },
  }),
}));

vi.mock('@react-native-vector-icons/ionicons/static', () => ({
  Ionicons: () => <span>icon</span>,

  default: () => <span>icon</span>,
  __esModule: true,
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
    accessibilityRole?: string;
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
        : { role: accessibilityRole })}
      type="button"
    >
      {children}
    </button>
  ),
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({
    accessibilityRole,
    children,
  }: {
    accessibilityRole?: string;
    children?: ReactNode;
  }) => <div role={accessibilityRole}>{children}</div>,
}));

describe('ExpenseBranchSelector', () => {
  it('omits branch radios when a choice is unavailable or unnecessary', () => {
    const { rerender } = render(
      <ExpenseBranchSelector
        branches={[]}
        onSelect={vi.fn()}
        selectedBranchId={null}
      />
    );

    expect(screen.queryByRole('radio')).not.toBeInTheDocument();

    rerender(
      <ExpenseBranchSelector
        branches={[{ id: 'branch-1', name: 'Lagos main' }]}
        onSelect={vi.fn()}
        selectedBranchId="branch-1"
      />
    );

    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it('renders the branch label', () => {
    render(
      <ExpenseBranchSelector
        branches={[
          { id: 'branch-1', name: 'Lagos main' },
          { id: 'branch-2', name: 'Lekki branch' },
        ]}
        onSelect={vi.fn()}
        selectedBranchId="branch-1"
      />
    );

    expect(screen.getByText('Branch')).toBeInTheDocument();
  });

  it('marks the selected branch as checked', () => {
    render(
      <ExpenseBranchSelector
        branches={[
          { id: 'branch-1', name: 'Lagos main' },
          { id: 'branch-2', name: 'Lekki branch' },
        ]}
        onSelect={vi.fn()}
        selectedBranchId="branch-1"
      />
    );

    expect(
      screen.getByRole('radio', { name: 'Assign expense to Lagos main' })
    ).toHaveAttribute('aria-checked', 'true');
  });

  it('leaves all branches unchecked when the selected branch is absent', () => {
    render(
      <ExpenseBranchSelector
        branches={[
          { id: 'branch-1', name: 'Lagos main' },
          { id: 'branch-2', name: 'Lekki branch' },
        ]}
        onSelect={vi.fn()}
        selectedBranchId="missing-branch"
      />
    );

    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toHaveAttribute('aria-checked', 'false');
    }
  });

  it('forwards branch selection', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <ExpenseBranchSelector
        branches={[
          { id: 'branch-1', name: 'Lagos main' },
          { id: 'branch-2', name: 'Lekki branch' },
        ]}
        onSelect={onSelect}
        selectedBranchId="branch-1"
      />
    );

    await user.click(
      screen.getByRole('radio', { name: 'Assign expense to Lekki branch' })
    );

    expect(onSelect).toHaveBeenCalledWith('branch-2');
  });
});

import '@testing-library/jest-dom/vitest';
import type { StoreReadinessItem } from '@baci/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DARK_COLORS } from '@/constants/theme';
import { SetupChecklistItem } from './SetupChecklistItem';

vi.mock('@react-native-vector-icons/ionicons', () => ({
  default: () => null,
  __esModule: true,
}));

vi.mock('react-native', () => ({
  Pressable: ({
    accessibilityHint,
    accessibilityLabel,
    accessibilityRole,
    children,
    onPress,
  }: {
    accessibilityHint?: string;
    accessibilityLabel?: string;
    accessibilityRole?: string;
    children?: ReactNode;
    onPress?: () => void;
  }) => (
    <button
      aria-description={accessibilityHint}
      aria-label={accessibilityLabel}
      onClick={() => onPress?.()}
      role={accessibilityRole}
      type="button"
    >
      {children}
    </button>
  ),
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

const item: StoreReadinessItem<'bank_account'> = {
  category: 'payments',
  completed: false,
  description: 'Required to receive payments via Paystack',
  id: 'bank_account',
  label: 'Add bank account',
  priority: 'required',
};

describe('SetupChecklistItem', () => {
  it('renders an actionable next-step item and delegates selection', () => {
    const onPress = vi.fn();

    render(
      <SetupChecklistItem
        colors={DARK_COLORS}
        isNext
        item={item}
        onPress={onPress}
      />
    );

    expect(screen.getByText('Add bank account')).toBeInTheDocument();
    expect(screen.getByText('NEXT STEP')).toBeInTheDocument();
    const action = screen.getByRole('button', {
      name: 'Add bank account, incomplete',
    });
    expect(action).toHaveAttribute(
      'aria-description',
      'Incomplete. Opens this setup item.'
    );
    fireEvent.click(action);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows a priority label for an incomplete non-next item', () => {
    render(
      <SetupChecklistItem
        colors={DARK_COLORS}
        isNext={false}
        item={item}
        onPress={vi.fn()}
      />
    );

    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  it('announces completion while keeping completed setup items actionable', () => {
    const onPress = vi.fn();

    render(
      <SetupChecklistItem
        colors={DARK_COLORS}
        isNext={false}
        item={{ ...item, completed: true }}
        onPress={onPress}
      />
    );

    const action = screen.getByRole('button', {
      name: 'Add bank account, completed',
    });
    expect(action).toHaveAttribute(
      'aria-description',
      'Completed. Opens this setup item.'
    );
    fireEvent.click(action);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

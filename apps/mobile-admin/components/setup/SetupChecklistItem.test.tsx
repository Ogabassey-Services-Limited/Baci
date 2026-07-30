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
    fireEvent.click(screen.getByRole('button'));
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
});

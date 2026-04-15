import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS } from '@/constants/theme';
import { BlogEditorDialogCard } from './BlogEditorDialogCard';

vi.mock('@/components/ui/AppDialogModal', () => ({
  AppDialogModal: ({
    children,
    visible,
  }: {
    children?: ReactNode;
    visible: boolean;
  }) => (visible ? <div>{children}</div> : null),
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
    <button
      aria-label={accessibilityLabel}
      onClick={() => onPress?.()}
      type="button"
    >
      {children}
    </button>
  ),
  StyleSheet: {
    absoluteFillObject: { position: 'absolute', inset: 0 },
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  TextInput: ({
    accessibilityLabel,
    onChangeText,
    value,
  }: {
    accessibilityLabel?: string;
    onChangeText?: (value: string) => void;
    value?: string;
  }) => (
    <input
      aria-label={accessibilityLabel}
      onChange={(event) => onChangeText?.(event.target.value)}
      value={value ?? ''}
    />
  ),
  View: ({
    accessibilityLabel,
    children,
  }: {
    accessibilityLabel?: string;
    children?: ReactNode;
  }) => <section aria-label={accessibilityLabel}>{children}</section>,
}));

describe('BlogEditorDialogCard', () => {
  it('renders a dialog with shared input and action handlers', () => {
    const onCancel = vi.fn();
    const onChangeText = vi.fn();
    const onConfirm = vi.fn();

    render(
      <BlogEditorDialogCard
        cancelAccessibilityLabel="Cancel dialog"
        colors={LIGHT_COLORS}
        confirmAccessibilityLabel="Confirm dialog"
        confirmButtonColor={LIGHT_COLORS.primary}
        confirmLabel="Insert"
        confirmTextColor={LIGHT_COLORS.textOnPrimary}
        dialogLabel="Shared editor dialog"
        inputAccessibilityLabel="Dialog input"
        onCancel={onCancel}
        onChangeText={onChangeText}
        onConfirm={onConfirm}
        placeholder="https://example.com"
        subtitle="Shared subtitle"
        title="Shared title"
        value="baci.com"
        visible={true}
      />
    );

    expect(screen.getByLabelText('Shared editor dialog')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Dialog input'), {
      target: { value: 'usebaci.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm dialog' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel dialog' }));

    expect(onChangeText).toHaveBeenCalledWith('usebaci.com');
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

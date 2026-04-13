import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ExpenseFormFields } from './ExpenseFormFields';

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      border: '#d1d5db',
      card: '#f8fafc',
      error: '#ef4444',
      primary: '#2563eb',
      text: '#111827',
      textMuted: '#9ca3af',
      textSecondary: '#6b7280',
    },
  }),
}));

vi.mock('@/components/ui/SafeImage', () => ({
  default: ({ source }: { source?: { uri?: string } }) => (
    <img alt="Receipt preview" src={source?.uri} />
  ),
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => <span>icon</span>,
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
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  TextInput: ({
    accessibilityLabel,
    onChangeText,
    placeholder,
    value,
  }: {
    accessibilityLabel?: string;
    onChangeText?: (value: string) => void;
    placeholder?: string;
    value?: string;
  }) => (
    <input
      aria-label={accessibilityLabel}
      onChange={(event) => onChangeText?.(event.target.value)}
      placeholder={placeholder}
      value={value ?? ''}
    />
  ),
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

describe('ExpenseFormFields', () => {
  it('forwards amount, description, category, and receipt actions', () => {
    const onAmountChange = vi.fn();
    const onDescriptionChange = vi.fn();
    const onOpenCategorySheet = vi.fn();
    const onReceiptPress = vi.fn();

    render(
      <ExpenseFormFields
        amount="12500"
        description="Office internet"
        onAmountChange={onAmountChange}
        onDescriptionChange={onDescriptionChange}
        onOpenCategorySheet={onOpenCategorySheet}
        onReceiptPress={onReceiptPress}
        receiptUri={null}
        selectedCategory="Marketing"
      />
    );

    expect(screen.getByDisplayValue('12,500')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Office internet')).toBeInTheDocument();
    expect(screen.getByText('Marketing')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Expense amount'), {
      target: { value: '45000' },
    });
    fireEvent.change(screen.getByLabelText('Expense description'), {
      target: { value: 'Updated note' },
    });
    fireEvent.click(screen.getByLabelText('Select expense category'));
    fireEvent.click(screen.getByLabelText('Add expense receipt'));

    expect(onAmountChange).toHaveBeenCalledWith('45000');
    expect(onDescriptionChange).toHaveBeenCalledWith('Updated note');
    expect(onOpenCategorySheet).toHaveBeenCalledTimes(1);
    expect(onReceiptPress).toHaveBeenCalledTimes(1);
  });

  it('shows the receipt preview state when a receipt is selected', () => {
    render(
      <ExpenseFormFields
        amount=""
        description=""
        onAmountChange={vi.fn()}
        onDescriptionChange={vi.fn()}
        onOpenCategorySheet={vi.fn()}
        onReceiptPress={vi.fn()}
        receiptUri="file:///receipt.jpg"
        selectedCategory="Inventory"
      />
    );

    expect(screen.getByAltText('Receipt preview')).toHaveAttribute(
      'src',
      'file:///receipt.jpg'
    );
    expect(screen.getByText('Change')).toBeInTheDocument();
  });
});

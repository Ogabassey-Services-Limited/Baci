import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ThemeColors } from '@/constants/theme';
import type { VariantInventoryUnit } from '@/hooks/useVariantInventory';
import type { Branch } from '@/schemas/branch';
import { VariantInventoryUnitCard } from './VariantInventoryUnitCard';

vi.mock('@react-native-vector-icons/ionicons', () => ({
  default: () => null,
  Ionicons: () => null,
  __esModule: true,
}));

vi.mock('react-native', async () => {
  const React = await import('react');
  return {
    Pressable: ({
      accessibilityLabel,
      children,
      onPress,
    }: {
      accessibilityLabel?: string;
      children?: React.ReactNode;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-label': accessibilityLabel,
          onClick: () => onPress?.(),
          type: 'button',
        },
        children
      ),
    StyleSheet: { create: (styles: Record<string, unknown>) => styles },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    TextInput: ({
      accessibilityLabel,
      onChangeText,
      value,
    }: {
      accessibilityLabel?: string;
      onChangeText?: (value: string) => void;
      value?: string;
    }) =>
      React.createElement('input', {
        'aria-label': accessibilityLabel,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
        value: value ?? '',
      }),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

const colors = {
  border: '#e2e8f0',
  card: '#ffffff',
  error: '#ef4444',
  inputBg: '#f8fafc',
  primary: '#2563eb',
  returned: '#9333ea',
  success: '#22c55e',
  text: '#0f172a',
  textOnPrimary: '#ffffff',
  textSecondary: '#64748b',
} as unknown as ThemeColors;

const branches = [{ id: 'branch-1', name: 'Branch A' }] as Branch[];

const unit: VariantInventoryUnit = {
  branch_id: 'branch-1',
  created_at: '2026-06-16T00:00:00Z',
  id: 'unit-1',
  identifier_type: 'imei',
  identifier_value: '123456789012345',
  merchant_id: 'merchant-1',
  notes: 'First batch',
  product_id: 'product-1',
  source: 'merchant_stock',
  status: 'available',
  updated_at: '2026-06-16T00:00:00Z',
  variant_id: 'variant-1',
};

describe('VariantInventoryUnitCard', () => {
  it('renders a read-only inventory unit and action buttons', () => {
    const onDelete = vi.fn();
    const onEdit = vi.fn();

    render(
      <VariantInventoryUnitCard
        branches={branches}
        colors={colors}
        editBranchId={null}
        editing={false}
        editNotes=""
        editStatus="available"
        onCancelEdit={vi.fn()}
        onDelete={onDelete}
        onEdit={onEdit}
        onEditBranchChange={vi.fn()}
        onEditNotesChange={vi.fn()}
        onEditStatusChange={vi.fn()}
        onSaveEdit={vi.fn()}
        unit={unit}
      />
    );

    expect(screen.getByText('123456789012345')).toBeInTheDocument();
    expect(
      screen.getByText('IMEI • Branch A • Source: merchant_stock')
    ).toBeInTheDocument();
    expect(screen.getByText('AVAILABLE')).toBeInTheDocument();
    expect(screen.getByText('Notes: First batch')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Edit unit 123456789012345' })
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete unit 123456789012345' })
    );

    expect(onEdit).toHaveBeenCalledWith(unit);
    expect(onDelete).toHaveBeenCalledWith(unit);
  });

  it('renders returned units, omits empty notes, and falls back to Central Stock', () => {
    render(
      <VariantInventoryUnitCard
        branches={branches}
        colors={colors}
        editBranchId={null}
        editing={false}
        editNotes=""
        editStatus="returned"
        onCancelEdit={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onEditBranchChange={vi.fn()}
        onEditNotesChange={vi.fn()}
        onEditStatusChange={vi.fn()}
        onSaveEdit={vi.fn()}
        unit={{
          ...unit,
          branch_id: 'missing-branch',
          notes: null,
          status: 'returned',
        }}
      />
    );

    expect(screen.getByText('RETURNED')).toBeInTheDocument();
    expect(
      screen.getByText('IMEI • Central Stock • Source: merchant_stock')
    ).toBeInTheDocument();
    expect(screen.queryByText(/^Notes:/)).not.toBeInTheDocument();
  });

  it('renders additional inventory statuses', () => {
    for (const status of ['reserved', 'sold', 'defective'] as const) {
      const { unmount } = render(
        <VariantInventoryUnitCard
          branches={branches}
          colors={colors}
          editBranchId={null}
          editing={false}
          editNotes=""
          editStatus={status}
          onCancelEdit={vi.fn()}
          onDelete={vi.fn()}
          onEdit={vi.fn()}
          onEditBranchChange={vi.fn()}
          onEditNotesChange={vi.fn()}
          onEditStatusChange={vi.fn()}
          onSaveEdit={vi.fn()}
          unit={{ ...unit, id: `unit-${status}`, status }}
        />
      );

      expect(screen.getByText(status.toUpperCase())).toBeInTheDocument();
      unmount();
    }
  });

  it('renders edit controls and saves selected values', () => {
    const onEditBranchChange = vi.fn();
    const onEditNotesChange = vi.fn();
    const onEditStatusChange = vi.fn();
    const onSaveEdit = vi.fn();

    render(
      <VariantInventoryUnitCard
        branches={branches}
        colors={colors}
        editBranchId={null}
        editing={true}
        editNotes="First batch"
        editStatus="available"
        onCancelEdit={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onEditBranchChange={onEditBranchChange}
        onEditNotesChange={onEditNotesChange}
        onEditStatusChange={onEditStatusChange}
        onSaveEdit={onSaveEdit}
        unit={unit}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Select status defective' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Assign to Branch A' }));
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Unit notes input' }),
      {
        target: { value: 'Damaged' },
      }
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save unit changes' }));

    expect(onEditStatusChange).toHaveBeenCalledWith('defective');
    expect(onEditBranchChange).toHaveBeenCalledWith('branch-1');
    expect(onEditNotesChange).toHaveBeenCalledWith('Damaged');
    expect(onSaveEdit).toHaveBeenCalledWith(unit);
  });
});

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ThemeColors } from '@/constants/theme';
import type { Branch } from '@/schemas/branch';
import { ProductRestockOptions } from './ProductRestockOptions';

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
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

const colors = {
  border: '#e2e8f0',
  primary: '#2563eb',
  text: '#0f172a',
} as unknown as ThemeColors;

const branches: Branch[] = [
  {
    active: true,
    address: null,
    city: null,
    created_at: '2026-06-16T00:00:00Z',
    id: '11111111-1111-4111-8111-111111111111',
    is_default: true,
    manager_id: null,
    merchant_id: '22222222-2222-4222-8222-222222222222',
    name: 'Branch A',
    phone: null,
    state: null,
    updated_at: null,
  },
  {
    active: true,
    address: null,
    city: null,
    created_at: '2026-06-16T00:00:00Z',
    id: '33333333-3333-4333-8333-333333333333',
    is_default: false,
    manager_id: null,
    merchant_id: '22222222-2222-4222-8222-222222222222',
    name: 'Branch B',
    phone: null,
    state: null,
    updated_at: null,
  },
];

describe('ProductRestockOptions', () => {
  it('routes mode, branch, and source selections to handlers', () => {
    const onBranchChange = vi.fn();
    const onModeChange = vi.fn();
    const onSourceChange = vi.fn();

    render(
      <ProductRestockOptions
        branches={branches}
        colors={colors}
        mode="imei"
        onBranchChange={onBranchChange}
        onModeChange={onModeChange}
        onSourceChange={onSourceChange}
        selectedBranchId={null}
        source="merchant_stock"
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Select Serial Number mode' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Assign to Branch B' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Select source Dropship' })
    );

    expect(onModeChange).toHaveBeenCalledWith('serial');
    expect(onBranchChange).toHaveBeenCalledWith(branches[1].id);
    expect(onSourceChange).toHaveBeenCalledWith('dropship');
  });

  it('hides branch assignment options when only one branch is available', () => {
    const onBranchChange = vi.fn();

    render(
      <ProductRestockOptions
        branches={[branches[0]]}
        colors={colors}
        mode="imei"
        onBranchChange={onBranchChange}
        onModeChange={vi.fn()}
        onSourceChange={vi.fn()}
        selectedBranchId={null}
        source="merchant_stock"
      />
    );

    expect(screen.queryByText('Assign to Branch')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Assign to all/no specific branch' })
    ).not.toBeInTheDocument();
    expect(onBranchChange).not.toHaveBeenCalled();
  });
});

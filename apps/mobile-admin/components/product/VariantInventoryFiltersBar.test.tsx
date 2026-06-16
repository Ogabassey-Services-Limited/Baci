import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ThemeColors } from '@/constants/theme';
import type { Branch } from '@/schemas/branch';
import { VariantInventoryFiltersBar } from './VariantInventoryFiltersBar';

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
    ScrollView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
      hairlineWidth: 1,
    },
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
  textOnPrimary: '#ffffff',
  textSecondary: '#64748b',
} as unknown as ThemeColors;

const branches = [{ id: 'branch-1', name: 'Branch A' }] as Branch[];

describe('VariantInventoryFiltersBar', () => {
  it('notifies parent when status and branch filters change', () => {
    const onBranchFilterChange = vi.fn();
    const onStatusFilterChange = vi.fn();

    render(
      <VariantInventoryFiltersBar
        branchFilter={null}
        branches={branches}
        colors={colors}
        onBranchFilterChange={onBranchFilterChange}
        onStatusFilterChange={onStatusFilterChange}
        statusFilter={null}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Filter by reserved' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Filter by Central Stock' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Filter by Branch A' }));

    expect(onStatusFilterChange).toHaveBeenCalledWith('reserved');
    expect(onBranchFilterChange).toHaveBeenCalledWith('central');
    expect(onBranchFilterChange).toHaveBeenCalledWith('branch-1');
  });
});

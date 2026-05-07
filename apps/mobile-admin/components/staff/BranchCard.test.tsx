import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS, SHADOWS } from '@/constants/theme';
import { BranchCard } from './BranchCard';

vi.mock('@expo/vector-icons', async () => {
  const React = await import('react');
  return {
    Ionicons: ({ name }: { name: string }) =>
      React.createElement('span', { 'data-icon': name }),
  };
});

vi.mock('react-native', async () => {
  const React = await import('react');
  return {
    Pressable: ({
      accessibilityLabel,
      accessibilityRole,
      accessibilityState,
      children,
      disabled,
      onPress,
    }: {
      accessibilityLabel?: string;
      accessibilityRole?: string;
      accessibilityState?: { disabled?: boolean };
      children?: React.ReactNode;
      disabled?: boolean;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-disabled': accessibilityState?.disabled,
          'aria-label': accessibilityLabel,
          disabled,
          onClick: onPress,
          role: accessibilityRole === 'button' ? 'button' : undefined,
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

const branch = {
  id: 'branch-1',
  name: 'Lagos main',
  address: null,
  city: 'Lagos',
  is_default: true,
  active: true,
};

describe('BranchCard', () => {
  it('exposes visible edit and deactivate actions', () => {
    const onEdit = vi.fn();
    const onDeactivate = vi.fn();

    render(
      <BranchCard
        branch={branch}
        colors={LIGHT_COLORS}
        shadows={SHADOWS}
        canDeactivate={true}
        onDeactivate={onDeactivate}
        onEdit={onEdit}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit Lagos main' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Deactivate Lagos main' })
    );

    expect(onEdit).toHaveBeenCalledWith('branch-1');
    expect(onDeactivate).toHaveBeenCalledWith('branch-1');
  });

  it('keeps the deactivate action visible but disabled for the only active branch', () => {
    const onDeactivate = vi.fn();

    render(
      <BranchCard
        branch={branch}
        colors={LIGHT_COLORS}
        shadows={SHADOWS}
        canDeactivate={false}
        onDeactivate={onDeactivate}
        onEdit={vi.fn()}
      />
    );

    const deactivateButton = screen.getByRole('button', {
      name: 'Deactivate Lagos main',
    }) as HTMLButtonElement;

    expect(deactivateButton.disabled).toBe(true);
    fireEvent.click(deactivateButton);
    expect(onDeactivate).not.toHaveBeenCalled();
  });
});

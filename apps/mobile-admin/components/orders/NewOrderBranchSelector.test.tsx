import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { NewOrderBranchSelector } from './NewOrderBranchSelector';

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
      onPress,
    }: {
      accessibilityLabel?: string;
      accessibilityRole?: string;
      accessibilityState?: { checked?: boolean };
      children?: React.ReactNode;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-checked': accessibilityState?.checked,
          'aria-label': accessibilityLabel,
          onClick: onPress,
          role: accessibilityRole === 'radio' ? 'radio' : undefined,
          type: 'button',
        },
        children
      ),
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    View: ({
      accessibilityRole,
      children,
    }: {
      accessibilityRole?: string;
      children?: React.ReactNode;
    }) =>
      React.createElement(
        'div',
        { role: accessibilityRole === 'radiogroup' ? 'radiogroup' : undefined },
        children
      ),
    StyleSheet: {
      create: <T,>(styles: T) => styles,
    },
  };
});

const colors = {
  background: '#ffffff',
  backgroundLight: '#eff6ff',
  border: '#cbd5e1',
  primary: '#2563eb',
  text: '#111827',
  textOnPrimary: '#ffffff',
};

const styles = {
  iconBox: {},
  listLabel: {},
  listRow: {},
};

describe('NewOrderBranchSelector', () => {
  it('renders branch choices and selects a branch', () => {
    const setSelectedBranchId = vi.fn();

    render(
      <NewOrderBranchSelector
        branches={[
          { id: 'branch-1', name: 'Lagos main' },
          { id: 'branch-2', name: 'Abuja' },
        ]}
        selectedBranchId="branch-1"
        setSelectedBranchId={setSelectedBranchId}
        colors={colors}
        styles={styles}
      />
    );

    expect(screen.getByText('Branch')).toBeInTheDocument();
    expect(screen.getByText('Lagos main')).toBeInTheDocument();
    expect(screen.getByText('Abuja')).toBeInTheDocument();
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: 'Select Lagos main branch' })
    ).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(screen.getByRole('radio', { name: 'Select Abuja branch' }));

    expect(setSelectedBranchId).toHaveBeenCalledWith('branch-2');
  });

  it('renders no selector when there are no branch choices', () => {
    const setSelectedBranchId = vi.fn();

    render(
      <NewOrderBranchSelector
        branches={[]}
        selectedBranchId={null}
        setSelectedBranchId={setSelectedBranchId}
        colors={colors}
        styles={styles}
      />
    );

    expect(screen.queryByText('Branch')).not.toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(setSelectedBranchId).not.toHaveBeenCalled();
  });

  it('leaves every radio unchecked when no branch is selected', () => {
    const setSelectedBranchId = vi.fn();

    render(
      <NewOrderBranchSelector
        branches={[
          { id: 'branch-1', name: 'Lagos main' },
          { id: 'branch-2', name: 'Abuja' },
        ]}
        selectedBranchId={null}
        setSelectedBranchId={setSelectedBranchId}
        colors={colors}
        styles={styles}
      />
    );

    expect(
      screen
        .getAllByRole('radio')
        .every((radio) => radio.getAttribute('aria-checked') !== 'true')
    ).toBe(true);

    fireEvent.click(screen.getByRole('radio', { name: 'Select Abuja branch' }));

    expect(setSelectedBranchId).toHaveBeenCalledWith('branch-2');
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BranchPill } from './BranchPill';

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
      accessibilityState?: { selected?: boolean };
      children?: React.ReactNode;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-label': accessibilityLabel,
          'aria-pressed': accessibilityState?.selected,
          onClick: onPress,
          role: accessibilityRole === 'button' ? 'button' : undefined,
        },
        children
      ),
    StyleSheet: { create: (styles: Record<string, unknown>) => styles },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
  };
});

describe('BranchPill', () => {
  it('renders an accessible selectable branch pill', () => {
    const onPress = vi.fn();

    render(
      <BranchPill
        icon="location"
        label="Lagos main"
        selected={true}
        colors={{
          border: '#ddd',
          card: '#fff',
          primary: '#2563eb',
          text: '#111',
          textOnPrimary: '#fff',
        }}
        accessibilityLabel="Switch to Lagos main branch"
        accessibilityHint="Double tap to set as active branch"
        onPress={onPress}
      />
    );

    expect(screen.getByText('Lagos main')).toBeTruthy();
    const button = screen.getByRole('button', {
      name: 'Switch to Lagos main branch',
    });
    expect(button.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(button);

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders an unselected branch pill without selected state', () => {
    const onPress = vi.fn();

    render(
      <BranchPill
        icon="location"
        label="Abuja branch"
        selected={false}
        colors={{
          border: '#ddd',
          card: '#fff',
          primary: '#2563eb',
          text: '#111',
          textOnPrimary: '#fff',
        }}
        accessibilityLabel="Switch to Abuja branch"
        accessibilityHint="Double tap to set as active branch"
        onPress={onPress}
      />
    );

    expect(screen.getByText('Abuja branch')).toBeTruthy();
    expect(
      screen
        .getByRole('button', { name: 'Switch to Abuja branch' })
        .getAttribute('aria-pressed')
    ).toBe('false');
  });
});

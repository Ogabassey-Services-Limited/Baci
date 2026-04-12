import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BusinessTypeSelector } from '@/components/auth/BusinessTypeSelector';

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    Pressable: ({
      accessibilityLabel,
      accessibilityState,
      children,
      onPress,
    }: {
      accessibilityLabel?: string;
      accessibilityState?: { selected?: boolean };
      children?: React.ReactNode;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-label': accessibilityLabel,
          'aria-pressed': accessibilityState?.selected ? 'true' : 'false',
          onClick: onPress,
        },
        children
      ),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

describe('BusinessTypeSelector', () => {
  it('renders the business type options and forwards selection', () => {
    const onSelect = vi.fn();

    render(
      <BusinessTypeSelector
        borderColor="#ddd"
        cardBackgroundColor="#fff"
        onSelect={onSelect}
        selectedBackgroundColor="#2563eb"
        selectedBorderColor="#2563eb"
        selectedTextColor="#fff"
        selectedType=""
        textColor="#111"
      />
    );

    fireEvent.click(
      screen.getByLabelText('Electronics & Gadgets business type')
    );

    expect(onSelect).toHaveBeenCalledWith('electronics');
  });

  it('marks the selected business type for assistive tech', () => {
    render(
      <BusinessTypeSelector
        borderColor="#ddd"
        cardBackgroundColor="#fff"
        onSelect={vi.fn()}
        selectedBackgroundColor="#2563eb"
        selectedBorderColor="#2563eb"
        selectedTextColor="#fff"
        selectedType="electronics"
        textColor="#111"
      />
    );

    expect(
      screen
        .getByLabelText('Electronics & Gadgets business type')
        .getAttribute('aria-pressed')
    ).toBe('true');
  });
});

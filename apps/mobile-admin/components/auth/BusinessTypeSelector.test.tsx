import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BusinessTypeSelector } from '@/components/auth/BusinessTypeSelector';

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
        { 'aria-label': accessibilityLabel, onClick: onPress },
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
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-vector-icons/ionicons', () => ({
  default: () => null,
}));

vi.mock('./NewOrderCustomerCreateView.styles', () => ({
  customerCreateStyles: {
    typeToggle: {},
    typeToggleLabel: {},
    typeToggleOption: {},
  },
}));

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
          'aria-pressed': accessibilityState?.selected ?? false,
          onClick: onPress,
          type: 'button',
        },
        children
      ),
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

import { NewCustomerTypeToggle } from './NewCustomerTypeToggle';

const colors = {
  border: '#e2e8f0',
  inputBg: '#f8fafc',
  primary: '#2563eb',
  textMuted: '#94a3b8',
  textOnPrimary: '#ffffff',
} as unknown as Parameters<typeof NewCustomerTypeToggle>[0]['colors'];

describe('NewCustomerTypeToggle', () => {
  it('marks the active option as selected', () => {
    render(
      <NewCustomerTypeToggle
        colors={colors}
        onChange={vi.fn()}
        value="company"
      />
    );

    expect(
      screen
        .getByRole('button', { name: 'Set customer type to Company' })
        .getAttribute('aria-pressed')
    ).toBe('true');
    expect(
      screen
        .getByRole('button', { name: 'Set customer type to Person' })
        .getAttribute('aria-pressed')
    ).toBe('false');
  });

  it('calls onChange with the pressed customer type', () => {
    const onChange = vi.fn();
    render(
      <NewCustomerTypeToggle
        colors={colors}
        onChange={onChange}
        value="individual"
      />
    );

    screen
      .getByRole('button', { name: 'Set customer type to Company' })
      .click();

    expect(onChange).toHaveBeenCalledWith('company');
  });
});

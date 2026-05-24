import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PasswordVisibilityToggle } from '@/components/auth/PasswordVisibilityToggle';

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
  };
});

vi.mock('@react-native-vector-icons/ionicons/static', async () => {
  const React = await import('react');

  return {
    Ionicons: ({ color, name }: { color: string; name: string }) =>
      React.createElement('span', { 'data-color': color }, name),

    default: ({ color, name }: { color: string; name: string }) =>
      React.createElement(
        'span',
        {
          'data-color': color,
        },
        name
      ),
    __esModule: true,
  };
});

describe('PasswordVisibilityToggle', () => {
  it('renders the requested icon and forwards presses', () => {
    const onPress = vi.fn();

    render(
      <PasswordVisibilityToggle
        accessibilityLabel="Show password"
        iconColor="#999"
        iconName="eye-outline"
        onPress={onPress}
      />
    );

    fireEvent.click(screen.getByLabelText('Show password'));

    expect(screen.getByText('eye-outline').getAttribute('data-color')).toBe(
      '#999'
    );
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

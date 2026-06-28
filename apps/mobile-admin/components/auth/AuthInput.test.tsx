import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthInput } from '@/components/auth/AuthInput';
import { PasswordVisibilityToggle } from '@/components/auth/PasswordVisibilityToggle';

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    StatusBar: () => null,
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
    TextInput: ({
      accessibilityLabel,
      accessibilityState,
      editable,
      onChangeText,
      placeholder,
      value,
    }: {
      accessibilityLabel?: string;
      accessibilityState?: { disabled?: boolean };
      editable?: boolean;
      onChangeText?: (text: string) => void;
      placeholder?: string;
      value?: string;
    }) =>
      React.createElement('input', {
        'aria-label': accessibilityLabel,
        'aria-disabled': accessibilityState?.disabled ? 'true' : undefined,
        disabled: editable === false,
        placeholder,
        value: value ?? '',
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
      }),
    View: ({
      children,
      style,
    }: {
      children?: React.ReactNode;
      style?: unknown;
    }) =>
      React.createElement(
        'div',
        { 'data-style': JSON.stringify(style) },
        children
      ),
  };
});

vi.mock('@react-native-vector-icons/ionicons', async () => {
  const React = await import('react');

  return {
    Ionicons: ({ name }: { name: string }) =>
      React.createElement('span', null, name),

    default: ({ name }: { name: string }) =>
      React.createElement('span', null, name),
    __esModule: true,
  };
});

describe('AuthInput', () => {
  it('renders the label and forwards input changes', () => {
    const onChangeText = vi.fn();

    render(
      <AuthInput
        borderColor="#ddd"
        iconColor="#666"
        iconName="mail-outline"
        label="Email"
        labelColor="#111"
        onChangeText={onChangeText}
        placeholder="you@example.com"
        placeholderTextColor="#888"
        textColor="#111"
        value=""
        wrapperColor="#fff"
      />
    );

    expect(screen.getByText('Email')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'merchant@example.com' },
    });

    expect(onChangeText).toHaveBeenCalledWith('merchant@example.com');
  });

  it('conveys disabled state visually and semantically', () => {
    render(
      <AuthInput
        borderColor="#ddd"
        iconColor="#666"
        iconName="mail-outline"
        label="Email"
        labelColor="#111"
        onChangeText={vi.fn()}
        placeholder="you@example.com"
        placeholderTextColor="#888"
        textColor="#111"
        value=""
        wrapperColor="#fff"
        editable={false}
      />
    );
    expect(screen.getByLabelText('Email').getAttribute('aria-disabled')).toBe(
      'true'
    );
    expect(screen.getByLabelText('Email').hasAttribute('disabled')).toBe(true);
    expect(
      screen.getByText('Email').parentElement?.getAttribute('data-style')
    ).toContain('"opacity":0.5');
  });

  it('renders the password visibility toggle action', () => {
    const onPress = vi.fn();

    render(
      <PasswordVisibilityToggle
        accessibilityLabel="Show password"
        iconColor="#666"
        iconName="eye-outline"
        onPress={onPress}
      />
    );

    fireEvent.click(screen.getByLabelText('Show password'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  AuthInput,
  PasswordVisibilityToggle,
} from '@/components/auth/AuthInput';

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
    TextInput: ({
      onChangeText,
      placeholder,
      value,
    }: {
      onChangeText?: (text: string) => void;
      placeholder?: string;
      value?: string;
    }) =>
      React.createElement('input', {
        placeholder,
        value: value ?? '',
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
      }),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('@expo/vector-icons', async () => {
  const React = await import('react');

  return {
    Ionicons: ({ name }: { name: string }) =>
      React.createElement('span', null, name),
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
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'merchant@example.com' },
    });

    expect(onChangeText).toHaveBeenCalledWith('merchant@example.com');
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

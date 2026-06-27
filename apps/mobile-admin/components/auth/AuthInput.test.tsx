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
      onChangeText,
      placeholder,
      value,
    }: {
      accessibilityLabel?: string;
      accessibilityState?: { disabled?: boolean };
      onChangeText?: (text: string) => void;
      placeholder?: string;
      value?: string;
    }) =>
      React.createElement('input', {
        'aria-label': accessibilityLabel,
        'aria-disabled': accessibilityState?.disabled ? 'true' : undefined,
        placeholder,
        value: value ?? '',
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
      }),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
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

  it('renders disabled state programmatically when editable is false', () => {
    render(
      <AuthInput
        borderColor="#ddd"
        editable={false}
        iconColor="#666"
        iconName="mail-outline"
        label="Email"
        labelColor="#111"
        onChangeText={() => {}}
        placeholder="you@example.com"
        placeholderTextColor="#888"
        textColor="#111"
        value=""
        wrapperColor="#fff"
      />
    );

    expect(screen.getByLabelText('Email').getAttribute('aria-disabled')).toBe(
      'true'
    );
  });

  it('renders active state programmatically when editable is omitted (defaults to true)', () => {
    render(
      <AuthInput
        borderColor="#ddd"
        iconColor="#666"
        iconName="mail-outline"
        label="Email"
        labelColor="#111"
        onChangeText={() => {}}
        placeholder="you@example.com"
        placeholderTextColor="#888"
        textColor="#111"
        value=""
        wrapperColor="#fff"
      />
    );

    expect(
      screen.getByLabelText('Email').getAttribute('aria-disabled')
    ).toBeFalsy();
  });
});

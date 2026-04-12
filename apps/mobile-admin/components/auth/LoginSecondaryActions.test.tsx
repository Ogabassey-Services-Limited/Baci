import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LoginSecondaryActions } from '@/components/auth/LoginSecondaryActions';

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    __DEV__: false,
    ActivityIndicator: () => React.createElement('span', null, 'loading'),
    Alert: { alert: mocks.alert },
    Platform: { OS: 'web' },
    Pressable: ({
      accessibilityLabel,
      children,
      disabled,
      onPress,
    }: {
      accessibilityLabel?: string;
      children?: React.ReactNode;
      disabled?: boolean;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        { 'aria-label': accessibilityLabel, disabled, onClick: onPress },
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

vi.mock('@expo/vector-icons', async () => {
  const React = await import('react');

  return {
    Ionicons: ({ name }: { name: string }) =>
      React.createElement('span', null, name),
  };
});

vi.mock('@/components/auth/GoogleLogo', async () => {
  const React = await import('react');

  return {
    GoogleLogo: () => React.createElement('span', null, 'GoogleLogo'),
  };
});

describe('LoginSecondaryActions', () => {
  it('forwards sign-up presses', () => {
    const onSignUp = vi.fn();

    render(
      <LoginSecondaryActions
        colors={{
          border: '#ddd',
          card: '#fff',
          text: '#111',
          textMuted: '#666',
        }}
        isAnyLoading={false}
        isAppleLoading={false}
        isGoogleLoading={false}
        onAppleSignIn={vi.fn()}
        onGoogleSignIn={vi.fn()}
        onSignUp={onSignUp}
        replace={vi.fn()}
        showAppleSignIn={false}
      />
    );

    fireEvent.click(
      screen.getByLabelText('Sign up for a new merchant account')
    );

    expect(onSignUp).toHaveBeenCalledTimes(1);
  });
});

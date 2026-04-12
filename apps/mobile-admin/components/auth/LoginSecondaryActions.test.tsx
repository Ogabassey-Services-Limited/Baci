import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LoginSecondaryActions } from '@/components/auth/LoginSecondaryActions';

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  __DEV__: true,
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    __DEV__: mocks.__DEV__,
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
  it('forwards Google sign-in presses', () => {
    const onGoogleSignIn = vi.fn();

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
        onGoogleSignIn={onGoogleSignIn}
        onSignUp={vi.fn()}
        replace={vi.fn()}
        showAppleSignIn={false}
      />
    );

    fireEvent.click(screen.getByLabelText('Sign in with Google'));

    expect(onGoogleSignIn).toHaveBeenCalledTimes(1);
  });

  it('forwards Apple sign-in presses when enabled', () => {
    const onAppleSignIn = vi.fn();

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
        onAppleSignIn={onAppleSignIn}
        onGoogleSignIn={vi.fn()}
        onSignUp={vi.fn()}
        replace={vi.fn()}
        showAppleSignIn={true}
      />
    );

    fireEvent.click(screen.getByLabelText('Sign in with Apple'));

    expect(onAppleSignIn).toHaveBeenCalledTimes(1);
  });

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

  it('runs the dev reset action when available', () => {
    const onResetOnboarding = vi.fn().mockResolvedValue(undefined);

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
        onResetOnboarding={onResetOnboarding}
        onSignUp={vi.fn()}
        replace={vi.fn()}
        showAppleSignIn={false}
      />
    );

    fireEvent.click(screen.getByText('Reset Onboarding (Dev)'));

    expect(onResetOnboarding).toHaveBeenCalledTimes(1);
  });

  it('shows loading state and disables actions while loading', () => {
    render(
      <LoginSecondaryActions
        colors={{
          border: '#ddd',
          card: '#fff',
          text: '#111',
          textMuted: '#666',
        }}
        isAnyLoading={true}
        isAppleLoading={true}
        isGoogleLoading={true}
        onAppleSignIn={vi.fn()}
        onGoogleSignIn={vi.fn()}
        onSignUp={vi.fn()}
        replace={vi.fn()}
        showAppleSignIn={true}
      />
    );

    expect(
      (screen.getByLabelText('Signing in with Google') as HTMLButtonElement)
        .disabled
    ).toBe(true);
    expect(
      (screen.getByLabelText('Signing in with Apple') as HTMLButtonElement)
        .disabled
    ).toBe(true);
    expect(
      (
        screen.getByLabelText(
          'Sign up for a new merchant account'
        ) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    expect(screen.getAllByText('loading')).toHaveLength(2);
  });
});

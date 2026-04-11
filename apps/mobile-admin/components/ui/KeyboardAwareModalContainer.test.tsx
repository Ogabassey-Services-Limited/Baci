import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KeyboardAwareModalContainer } from './KeyboardAwareModalContainer';

const platform = vi.hoisted(() => ({ OS: 'ios' }));
const keyboardAvoidingViewProps = vi.hoisted(() => ({
  behavior: '',
  keyboardVerticalOffset: 0,
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    KeyboardAvoidingView: ({
      behavior,
      children,
      keyboardVerticalOffset,
    }: {
      behavior?: string;
      children?: React.ReactNode;
      keyboardVerticalOffset?: number;
    }) => {
      keyboardAvoidingViewProps.behavior = behavior ?? '';
      keyboardAvoidingViewProps.keyboardVerticalOffset =
        keyboardVerticalOffset ?? 0;
      return React.createElement(
        'div',
        { role: 'region', 'aria-label': 'keyboard-avoiding-view' },
        children
      );
    },
    Platform: platform,
    ScrollView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(
        'div',
        { role: 'region', 'aria-label': 'keyboard-scroll-view' },
        children
      ),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(
        'div',
        { role: 'region', 'aria-label': 'keyboard-view' },
        children
      ),
  };
});

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 12, left: 0 }),
}));

describe('KeyboardAwareModalContainer', () => {
  beforeEach(() => {
    platform.OS = 'ios';
    keyboardAvoidingViewProps.behavior = '';
    keyboardAvoidingViewProps.keyboardVerticalOffset = 0;
  });

  it('renders children inside keyboard-safe wrappers', () => {
    render(
      <KeyboardAwareModalContainer align="center">
        <div>Keyboard-safe child</div>
      </KeyboardAwareModalContainer>
    );

    expect(
      screen.getByRole('region', { name: 'keyboard-avoiding-view' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'keyboard-scroll-view' })
    ).toBeInTheDocument();
    expect(screen.getByText('Keyboard-safe child')).toBeInTheDocument();
  });

  it('renders without a scroll view when disabled', () => {
    render(
      <KeyboardAwareModalContainer scrollEnabled={false}>
        <div>Static child</div>
      </KeyboardAwareModalContainer>
    );

    expect(
      screen.getByRole('region', { name: 'keyboard-avoiding-view' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'keyboard-scroll-view' })
    ).toBeNull();
    expect(
      screen.getByRole('region', { name: 'keyboard-view' })
    ).toBeInTheDocument();
    expect(screen.getByText('Static child')).toBeInTheDocument();
  });

  it('keeps the keyboard-safe wrappers working on Android', () => {
    platform.OS = 'android';

    render(
      <KeyboardAwareModalContainer align="center">
        <div>Android child</div>
      </KeyboardAwareModalContainer>
    );

    expect(
      screen.getByRole('region', { name: 'keyboard-avoiding-view' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'keyboard-scroll-view' })
    ).toBeInTheDocument();
    expect(screen.getByText('Android child')).toBeInTheDocument();
    expect(keyboardAvoidingViewProps.behavior).toBe('height');
  });
});

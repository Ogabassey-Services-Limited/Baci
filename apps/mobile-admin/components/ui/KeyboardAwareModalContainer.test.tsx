import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { KeyboardAwareModalContainer } from './KeyboardAwareModalContainer';

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    KeyboardAvoidingView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(
        'div',
        { 'data-testid': 'keyboard-avoiding-view' },
        children
      ),
    Platform: {
      OS: 'ios',
    },
    ScrollView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(
        'div',
        { 'data-testid': 'keyboard-scroll-view' },
        children
      ),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
  };
});

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 12, left: 0 }),
}));

describe('KeyboardAwareModalContainer', () => {
  it('renders children inside keyboard-safe wrappers', () => {
    render(
      <KeyboardAwareModalContainer align="center">
        <div>Keyboard-safe child</div>
      </KeyboardAwareModalContainer>
    );

    expect(screen.getByTestId('keyboard-avoiding-view')).toBeTruthy();
    expect(screen.getByTestId('keyboard-scroll-view')).toBeTruthy();
    expect(screen.getByText('Keyboard-safe child')).toBeTruthy();
  });
});

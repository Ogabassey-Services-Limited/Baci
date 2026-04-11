import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppKeyboardContainer } from './AppKeyboardContainer';

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
    }) =>
      React.createElement(
        'div',
        {
          'data-behavior': behavior,
          'data-keyboard-offset': keyboardVerticalOffset,
          'data-testid': 'keyboard-avoiding-view',
        },
        children
      ),
    Platform: {
      OS: 'ios',
    },
    ScrollView: ({
      children,
      contentContainerStyle,
      keyboardDismissMode,
      keyboardShouldPersistTaps,
    }: {
      children?: React.ReactNode;
      contentContainerStyle?: unknown;
      keyboardDismissMode?: string;
      keyboardShouldPersistTaps?: string;
    }) =>
      React.createElement(
        'div',
        {
          'data-content-container-style': JSON.stringify(contentContainerStyle),
          'data-keyboard-dismiss-mode': keyboardDismissMode,
          'data-keyboard-taps': keyboardShouldPersistTaps,
          'data-testid': 'keyboard-scroll-view',
        },
        children
      ),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    View: ({
      children,
      style,
    }: {
      children?: React.ReactNode;
      style?: unknown;
    }) =>
      React.createElement(
        'div',
        {
          'data-style': JSON.stringify(style),
          'data-testid': 'keyboard-content-view',
        },
        children
      ),
  };
});

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 12, left: 0 }),
}));

describe('AppKeyboardContainer', () => {
  it('renders children inside the shared keyboard-safe wrappers', () => {
    render(
      <AppKeyboardContainer align="center">
        <div>Keyboard-safe child</div>
      </AppKeyboardContainer>
    );

    expect(screen.getByTestId('keyboard-avoiding-view')).toBeTruthy();
    expect(screen.getByTestId('keyboard-scroll-view')).toBeTruthy();
    expect(screen.getByText('Keyboard-safe child')).toBeTruthy();
  });

  it('applies the shared keyboard behavior contract', () => {
    render(
      <AppKeyboardContainer keyboardVerticalOffset={48}>
        <div>Contract</div>
      </AppKeyboardContainer>
    );

    const wrapper = screen.getByTestId('keyboard-avoiding-view');
    const scrollView = screen.getByTestId('keyboard-scroll-view');

    expect(wrapper.getAttribute('data-behavior')).toBe('padding');
    expect(wrapper.getAttribute('data-keyboard-offset')).toBe('48');
    expect(scrollView.getAttribute('data-keyboard-dismiss-mode')).toBe(
      'interactive'
    );
    expect(scrollView.getAttribute('data-keyboard-taps')).toBe('handled');
  });

  it('includes safe-area bottom padding in the scroll content style', () => {
    render(
      <AppKeyboardContainer>
        <div>Inset check</div>
      </AppKeyboardContainer>
    );

    const scrollView = screen.getByTestId('keyboard-scroll-view');
    const contentContainer = JSON.parse(
      scrollView.getAttribute('data-content-container-style') ?? '[]'
    ) as Record<string, unknown>[];
    const resolvedStyle = contentContainer.find(
      (value) => typeof value?.paddingBottom === 'number'
    );

    expect(resolvedStyle?.paddingBottom).toBe(16);
  });

  it('renders a non-scroll content view when scrolling is disabled', () => {
    render(
      <AppKeyboardContainer scrollEnabled={false}>
        <div>No scroll</div>
      </AppKeyboardContainer>
    );

    expect(screen.getByTestId('keyboard-content-view')).toBeTruthy();
    expect(screen.queryByTestId('keyboard-scroll-view')).toBeNull();
    expect(screen.getByText('No scroll')).toBeTruthy();
  });
});

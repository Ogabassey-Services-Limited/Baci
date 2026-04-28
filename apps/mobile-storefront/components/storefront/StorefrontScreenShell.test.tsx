import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

const mockUseSafeAreaInsets = jest.fn();

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({
    children,
    testID,
    ...props
  }: {
    children?: React.ReactNode;
    testID?: string;
  }) => {
    const React = jest.requireActual('react') as typeof import('react');
    const { View } = jest.requireActual(
      'react-native'
    ) as typeof import('react-native');

    return React.createElement(
      View,
      { testID: testID ?? 'storefront-screen-shell', ...props },
      children
    );
  },
  useSafeAreaInsets: () => mockUseSafeAreaInsets(),
}));

import { StorefrontScreenShell } from './StorefrontScreenShell';

describe('StorefrontScreenShell', () => {
  beforeEach(() => {
    mockUseSafeAreaInsets.mockReturnValue({
      top: 24,
      bottom: 34,
      left: 0,
      right: 0,
    });
  });

  it('wraps children in a bottom-only safe-area container by default', () => {
    // Default `edges` is ['bottom'] so we don't double-pad the safe-area-top
    // already reserved by react-native-screens NativeStack. See the comment
    // in StorefrontScreenShell.tsx for context.
    render(
      <StorefrontScreenShell>
        <Text>Content</Text>
      </StorefrontScreenShell>
    );

    const shell = screen.getByTestId('storefront-screen-shell');

    expect(shell.props.edges).toEqual(['bottom']);
    expect(StyleSheet.flatten(shell.props.style)).toMatchObject({
      flex: 1,
    });
    expect(screen.getByText('Content')).toBeTruthy();
  });

  it('accepts edge overrides and merges custom styles', () => {
    render(
      <StorefrontScreenShell
        edges={['bottom']}
        style={{ backgroundColor: '#111111' }}
        testID="custom-shell"
      >
        <Text>Content</Text>
      </StorefrontScreenShell>
    );

    const shell = screen.getByTestId('custom-shell');

    expect(shell.props.edges).toEqual(['bottom']);
    expect(StyleSheet.flatten(shell.props.style)).toMatchObject({
      flex: 1,
      backgroundColor: '#111111',
    });
  });

  it('renders without children and preserves explicit empty edges', () => {
    render(
      <StorefrontScreenShell edges={[]} testID="empty-shell">
        {null}
      </StorefrontScreenShell>
    );

    const shell = screen.getByTestId('empty-shell');

    expect(shell.props.edges).toEqual([]);
    expect(StyleSheet.flatten(shell.props.style)).toMatchObject({
      flex: 1,
    });
  });
});

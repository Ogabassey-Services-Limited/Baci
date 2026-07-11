import '@testing-library/jest-dom/vitest';
import { fireEvent, render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import { useSharedValue } from 'react-native-reanimated';
import { describe, expect, it, vi } from 'vitest';
import { TopTabBar } from './TopTabBar';

interface MockViewProps {
  children?: ReactNode;
  onLayout?: (event: { nativeEvent: { layout: { width: number } } }) => void;
  style?: unknown;
  testID?: string;
}

interface MockPressableProps {
  accessibilityLabel?: string;
  accessibilityState?: { selected?: boolean };
  children?: ReactNode;
  onPress?: () => void;
  testID?: string;
}

interface MockTextProps {
  children?: ReactNode;
}

// Mock Reanimated to prevent layout measurement issues in tests
vi.mock('react-native-reanimated', async () => {
  const React = await import('react');
  return {
    useSharedValue: vi.fn((init) => ({
      get: vi.fn(() => init),
      set: vi.fn(),
      value: init,
    })),
    useAnimatedStyle: vi.fn((cb) => cb()),
    withSpring: vi.fn((val) => val),
    withTiming: vi.fn((val) => val),
    default: {
      View: ({
        children,
        style,
        testID,
        ...props
      }: {
        children?: React.ReactNode;
        style?: unknown;
        testID?: string;
        [key: string]: unknown;
      }) =>
        React.createElement(
          'div',
          {
            'data-style': JSON.stringify(style),
            'data-testid': testID,
            ...props,
          },
          children
        ),
    },
  };
});

vi.mock('react-native', async () => {
  const React = await import('react');
  return {
    Platform: { OS: 'web' },
    Pressable: ({
      accessibilityLabel,
      accessibilityState,
      children,
      onPress,
      testID,
    }: MockPressableProps) =>
      React.createElement(
        'button',
        {
          'aria-label': accessibilityLabel,
          'aria-pressed': accessibilityState?.selected,
          'data-testid': testID,
          onClick: onPress,
          type: 'button',
        },
        children
      ),
    StyleSheet: {
      create: <T,>(styles: T) => styles,
    },
    Text: ({ children }: MockTextProps) =>
      React.createElement('span', null, children),
    useColorScheme: () => 'dark',
    View: ({ children, onLayout, style, testID }: MockViewProps) => {
      React.useEffect(() => {
        onLayout?.({ nativeEvent: { layout: { width: 200 } } });
      }, [onLayout]);

      return React.createElement(
        'div',
        {
          'data-style': JSON.stringify(style),
          'data-testid': testID,
        },
        children
      );
    },
  };
});

describe('TopTabBar', () => {
  it('renders both tabs', () => {
    const { getByText } = render(
      <TopTabBar
        activeTab="in_stock"
        onTabChange={vi.fn()}
        inStockCount={20}
        onWebsiteCount={10}
      />
    );

    expect(getByText('In Stock (20)')).toBeTruthy();
    expect(getByText('On Website (10)')).toBeTruthy();
  });

  it('calls onTabChange when a tab is pressed', () => {
    const onTabChange = vi.fn();
    const { getByText } = render(
      <TopTabBar activeTab="in_stock" onTabChange={onTabChange} />
    );

    fireEvent.click(getByText('On Website (0)'));
    expect(onTabChange).toHaveBeenCalledWith('on_website');

    fireEvent.click(getByText('In Stock (0)'));
    expect(onTabChange).toHaveBeenCalledWith('in_stock');
  });

  it('exposes selected tab state through accessible labels', () => {
    const { getByLabelText, rerender } = render(
      <TopTabBar activeTab="in_stock" onTabChange={vi.fn()} />
    );

    expect(getByLabelText('In Stock tab selected')).toBeTruthy();
    expect(getByLabelText('On Website tab not selected')).toBeTruthy();

    rerender(<TopTabBar activeTab="on_website" onTabChange={vi.fn()} />);

    expect(getByLabelText('In Stock tab not selected')).toBeTruthy();
    expect(getByLabelText('On Website tab selected')).toBeTruthy();
  });

  it('uses pager progress without allocating spring state', async () => {
    const useSharedValueMock = vi.mocked(useSharedValue);
    useSharedValueMock.mockClear();

    const { getByTestId } = render(
      <TopTabBar
        activeTab="in_stock"
        onTabChange={vi.fn()}
        pagerPosition={{ value: 0.25 } as SharedValue<number>}
      />
    );

    expect(useSharedValueMock).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(getByTestId('top-tab-indicator')).toHaveAttribute(
        'data-style',
        expect.stringContaining('"translateX":25')
      )
    );
  });

  it('uses spring state when pager progress is not supplied', () => {
    const useSharedValueMock = vi.mocked(useSharedValue);
    useSharedValueMock.mockClear();

    render(<TopTabBar activeTab="on_website" onTabChange={vi.fn()} />);

    expect(useSharedValueMock).toHaveBeenCalledWith(1);
  });
});

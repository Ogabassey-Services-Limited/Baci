import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TopTabBar } from './TopTabBar';

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

  it('applies active styling correctly', () => {
    const { getByText, rerender } = render(
      <TopTabBar activeTab="in_stock" onTabChange={vi.fn()} />
    );

    expect(getByText('In Stock (0)')).toBeTruthy();

    rerender(<TopTabBar activeTab="on_website" onTabChange={vi.fn()} />);
    expect(getByText('On Website (0)')).toBeTruthy();
  });
});

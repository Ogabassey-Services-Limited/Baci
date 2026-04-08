import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScreenSkeleton } from './ScreenSkeleton';

const reanimatedMocks = vi.hoisted(() => ({
  reducedMotion: false,
  cancelAnimation: vi.fn(),
  withRepeat: vi.fn(
    (animation: unknown, repetitions: number, reverse: boolean) => ({
      type: 'repeat',
      animation,
      repetitions,
      reverse,
    })
  ),
  withTiming: vi.fn((value: number, config: unknown) => ({
    type: 'timing',
    value,
    config,
  })),
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    View: ({
      children,
      style,
      testID,
    }: {
      children?: React.ReactNode;
      style?: unknown;
      testID?: string;
    }) =>
      React.createElement(
        'div',
        {
          'data-style': JSON.stringify(style),
          'data-testid': testID,
        },
        children
      ),
  };
});

vi.mock('react-native-reanimated', async () => {
  const React = await import('react');

  return {
    default: {
      View: ({
        accessibilityElementsHidden,
        accessible,
        children,
        importantForAccessibility,
        style,
        testID,
      }: {
        accessibilityElementsHidden?: boolean;
        accessible?: boolean;
        children?: React.ReactNode;
        importantForAccessibility?: string;
        style?: unknown;
        testID?: string;
      }) =>
        React.createElement(
          'div',
          {
            'data-accessibility-elements-hidden': accessibilityElementsHidden
              ? 'true'
              : 'false',
            'data-accessible': accessible ? 'true' : 'false',
            'data-important-for-accessibility': importantForAccessibility,
            'data-style': JSON.stringify(style),
            'data-testid': testID,
          },
          children
        ),
    },
    cancelAnimation: reanimatedMocks.cancelAnimation,
    useAnimatedStyle: (callback: () => object) => callback(),
    useReducedMotion: () => reanimatedMocks.reducedMotion,
    useSharedValue: (value: number) => ({ value }),
    withRepeat: reanimatedMocks.withRepeat,
    withTiming: reanimatedMocks.withTiming,
  };
});

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      border: '#D1D5DB',
      cardHover: '#E5E7EB',
    },
  }),
}));

describe('ScreenSkeleton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the settings skeleton structure', () => {
    const view = render(<ScreenSkeleton variant="settings" cards={2} />);

    expect(screen.getByTestId('screen-skeleton-settings')).toBeTruthy();
    expect(screen.getAllByTestId('settings-card')).toHaveLength(2);
    expect(screen.getAllByTestId('skeleton-block')).toHaveLength(8);
    expect(reanimatedMocks.withRepeat).toHaveBeenCalled();
    expect(view.asFragment()).toMatchSnapshot();
  });

  it('renders the list skeleton structure', () => {
    const view = render(<ScreenSkeleton variant="list" cards={3} />);

    expect(screen.getByTestId('screen-skeleton-list')).toBeTruthy();
    expect(screen.getAllByTestId('list-card')).toHaveLength(3);
    expect(screen.getAllByTestId('skeleton-block')).toHaveLength(10);
    expect(view.asFragment()).toMatchSnapshot();
  });

  it('renders the card-list skeleton structure', () => {
    const view = render(<ScreenSkeleton variant="card-list" cards={2} />);

    expect(screen.getByTestId('screen-skeleton-card-list')).toBeTruthy();
    expect(screen.getAllByTestId('card-list-card')).toHaveLength(2);
    expect(screen.getAllByTestId('skeleton-block')).toHaveLength(6);
    expect(view.asFragment()).toMatchSnapshot();
  });

  it('starts and stops the shimmer animation when the animated prop changes', () => {
    const view = render(
      <ScreenSkeleton variant="settings" cards={1} animated={false} />
    );

    expect(reanimatedMocks.withRepeat).not.toHaveBeenCalled();
    expect(reanimatedMocks.cancelAnimation).toHaveBeenCalled();

    view.rerender(<ScreenSkeleton variant="settings" cards={1} animated />);

    expect(reanimatedMocks.withRepeat).toHaveBeenCalled();

    view.rerender(
      <ScreenSkeleton variant="settings" cards={1} animated={false} />
    );

    expect(reanimatedMocks.cancelAnimation).toHaveBeenCalled();
  });

  it('skips shimmer animation when reduced motion is enabled', () => {
    reanimatedMocks.reducedMotion = true;

    render(<ScreenSkeleton variant="settings" cards={1} />);

    // With reduced motion, withRepeat should not be called
    expect(reanimatedMocks.withRepeat).not.toHaveBeenCalled();
    expect(reanimatedMocks.cancelAnimation).toHaveBeenCalled();

    // Restore for other tests
    reanimatedMocks.reducedMotion = false;
  });
});

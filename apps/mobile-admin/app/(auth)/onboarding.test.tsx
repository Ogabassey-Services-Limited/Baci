import '@testing-library/jest-dom/vitest';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { SPACING } from '@/constants/theme';
import OnboardingScreen from './onboarding';

const mocks = vi.hoisted(() => ({
  capturedFooterPaddingBottom: 0,
  insets: { bottom: 34, left: 0, right: 0, top: 0 },
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock('@/context/OnboardingContext', () => ({
  useOnboarding: () => ({
    completeOnboarding: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('expo-linear-gradient', () => ({
  LinearGradient: ({
    children,
  }: {
    children?: ReactNode;
  }) => <div>{children}</div>,
}));

vi.mock('react-native-edge-to-edge', () => ({
  SystemBars: () => null,
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: ReactNode }) => <section>{children}</section>,
  useSafeAreaInsets: () => mocks.insets,
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => <span>icon</span>,
}));

vi.mock('react-native', () => {
  class AnimatedValue {
    current: number;
    constructor(value: number) {
      this.current = value;
    }
    interpolate() {
      return this.current;
    }
  }

  return {
    Animated: {
      Value: AnimatedValue,
      View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
      event: () => () => undefined,
    },
    FlatList: ({
      data,
      renderItem,
    }: {
      data: Array<{ id: string }>;
      renderItem: (props: { item: unknown }) => ReactNode;
    }) => (
      <div>
        {data.map((item) => (
          <div key={item.id}>{renderItem({ item })}</div>
        ))}
      </div>
    ),
    Pressable: ({ children }: { children?: ReactNode }) => <button type="button">{children}</button>,
    StyleSheet: {
      absoluteFillObject: {},
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
    useWindowDimensions: () => ({ width: 390 }),
    View: ({ children, style }: { children?: ReactNode; style?: unknown }) => {
      const entries = (Array.isArray(style) ? style : [style]).filter(
        (entry): entry is Record<string, unknown> =>
          Boolean(entry) && typeof entry === 'object'
      );
      const mergedStyle = Object.assign({}, ...entries);

      if (
        'paddingHorizontal' in mergedStyle &&
        'gap' in mergedStyle &&
        'paddingBottom' in mergedStyle
      ) {
        mocks.capturedFooterPaddingBottom = Number(
          (mergedStyle as { paddingBottom?: number }).paddingBottom ?? 0
        );
      }
      return <div>{children}</div>;
    },
  };
});

describe('OnboardingScreen', () => {
  beforeAll(() => {
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.clearAllTimers();
    mocks.capturedFooterPaddingBottom = 0;
  });

  it('uses compact footer padding when bottom inset is present', () => {
    mocks.insets = { bottom: 34, left: 0, right: 0, top: 0 };
    render(<OnboardingScreen />);

    expect(mocks.capturedFooterPaddingBottom).toBe(SPACING.lg);
  });

  it('uses larger footer padding when bottom inset is absent', () => {
    mocks.insets = { bottom: 0, left: 0, right: 0, top: 0 };
    render(<OnboardingScreen />);

    expect(mocks.capturedFooterPaddingBottom).toBe(SPACING.xl);
  });
});

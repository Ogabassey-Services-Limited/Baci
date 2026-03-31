import { jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Animated } from 'react-native';
import Colors from '@/constants/Colors';
import { UtilityPanel } from './UtilityPanel';

type MockCategoriesResult = {
  data: unknown[];
  isLoading: boolean;
  error: Error | null;
};

const createCategoriesResult = (
  overrides: Partial<MockCategoriesResult> = {}
): MockCategoriesResult => ({
  data: [],
  isLoading: false,
  error: null,
  ...overrides,
});

const mockUseColorScheme = jest.fn(() => 'light');
const mockUseCategories = jest.fn<() => MockCategoriesResult>(() =>
  createCategoriesResult()
);
const mockUsePrefetchBillers = jest.fn();

function createAnimation() {
  return {
    start: (callback?: (result: { finished: boolean }) => void) => {
      callback?.({ finished: true });
    },
  };
}

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => mockUseColorScheme(),
}));

jest.mock('@/hooks', () => ({
  useCategories: () => mockUseCategories(),
}));

jest.mock('@/hooks/use-vtu-billers', () => ({
  usePrefetchBillers: () => mockUsePrefetchBillers(),
}));

describe('UtilityPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockUseColorScheme.mockReturnValue('light');
    mockUseCategories.mockReturnValue(createCategoriesResult());
    jest
      .spyOn(Animated, 'timing')
      .mockImplementation(
        () => createAnimation() as ReturnType<typeof Animated.timing>
      );
    jest
      .spyOn(Animated, 'spring')
      .mockImplementation(
        () => createAnimation() as ReturnType<typeof Animated.spring>
      );
    jest.spyOn(Animated, 'parallel').mockImplementation(
      (animations) =>
        ({
          start: (callback?: (result: { finished: boolean }) => void) => {
            for (const animation of animations) {
              animation.start?.();
            }
            callback?.({ finished: true });
          },
        }) as ReturnType<typeof Animated.parallel>
    );
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('applies light and dark theme tokens to promo and selected icon backgrounds', () => {
    const onCategorySelect = jest.fn();

    const { rerender } = render(
      <UtilityPanel
        selectedCategoryId={null}
        onCategorySelect={onCategorySelect}
      />
    );

    expect(screen.getByTestId('utility-panel-promo-banner')).toHaveStyle({
      backgroundColor: Colors.light.promoBackground,
    });
    expect(screen.getByTestId('utility-category-icon-u-airtime')).toHaveStyle({
      backgroundColor: Colors.light.selectedIconBackground,
    });

    mockUseColorScheme.mockReturnValue('dark');

    rerender(
      <UtilityPanel
        selectedCategoryId={null}
        onCategorySelect={onCategorySelect}
      />
    );

    expect(screen.getByTestId('utility-panel-promo-banner')).toHaveStyle({
      backgroundColor: Colors.dark.promoBackground,
    });
    expect(screen.getByTestId('utility-category-icon-u-airtime')).toHaveStyle({
      backgroundColor: Colors.dark.selectedIconBackground,
    });
  });

  it('renders an explicit error state for non-utility category failures', () => {
    mockUseCategories.mockReturnValue(
      createCategoriesResult({ error: new Error('boom') })
    );

    render(
      <UtilityPanel
        slug="phones"
        selectedCategoryId={null}
        onCategorySelect={jest.fn()}
      />
    );

    expect(screen.getByText('Unable to load categories')).toBeTruthy();
    expect(screen.getByText('Please try again in a moment.')).toBeTruthy();
  });

  it('auto-rotates promo words until a user manually selects a category', () => {
    const onCategorySelect = jest.fn();

    render(
      <UtilityPanel
        selectedCategoryId={null}
        onCategorySelect={onCategorySelect}
      />
    );

    expect(screen.getByText('Airtime!')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(2800);
    });

    expect(screen.getByText('Data!')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Power'));
    expect(onCategorySelect).toHaveBeenCalledWith('u-power');
    expect(screen.getByText('Power!')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(5600);
    });

    expect(screen.getByText('Power!')).toBeTruthy();
  });

  it('uses the selectedCategoryId prop to mark the chosen utility as active', () => {
    const onCategorySelect = jest.fn();
    const { rerender } = render(
      <UtilityPanel
        selectedCategoryId={null}
        onCategorySelect={onCategorySelect}
      />
    );

    fireEvent.press(screen.getByLabelText('Data'));

    rerender(
      <UtilityPanel
        selectedCategoryId="u-data"
        onCategorySelect={onCategorySelect}
      />
    );

    expect(screen.getByLabelText('Data')).toHaveAccessibilityState({
      selected: true,
    });
    expect(screen.getByLabelText('Airtime')).toHaveAccessibilityState({
      selected: false,
    });
  });

  it('restarts the promo animation when the active utility changes', () => {
    const timingSpy = jest.spyOn(Animated, 'timing');

    render(
      <UtilityPanel selectedCategoryId={null} onCategorySelect={jest.fn()} />
    );

    const initialCallCount = timingSpy.mock.calls.length;

    act(() => {
      jest.advanceTimersByTime(2800);
    });

    expect(timingSpy.mock.calls.length).toBeGreaterThan(initialCallCount);
  });
});

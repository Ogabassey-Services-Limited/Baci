import { describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ScrollView, StyleSheet } from 'react-native';
import Colors, { BRAND, SPACING } from '@/constants/Colors';
import { UtilityTypeTabs } from './UtilityTypeTabs';

let mockColorScheme: 'light' | 'dark' = 'light';
type UtilityColorScheme = 'light' | 'dark';
type UtilityThemeColors = (typeof Colors)[UtilityColorScheme];

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => mockColorScheme,
}));

function getTabStyle(type: string) {
  return StyleSheet.flatten(
    screen.getByTestId(`utility-tab-${type}-pill`).props.style
  );
}

// Layout widths used to drive the scroll-into-view math in tests. Real
// rendered widths are platform-dependent, so we synthesize stable values
// via onLayout events (the production component reads measurements from
// onLayout regardless of source).
const MEASURED_TAB_WIDTHS: Record<string, number> = {
  airtime: 96,
  data: 78,
  tv: 78,
  power: 92,
  gaming: 112,
};

function fireMeasuredLayouts(viewportWidth: number) {
  // Seed the ScrollView viewport width first so the centering effect runs.
  fireEvent(screen.getByTestId('utility-type-tabs-scroll'), 'layout', {
    nativeEvent: { layout: { width: viewportWidth, height: 38, x: 0, y: 0 } },
  });

  for (const [type, width] of Object.entries(MEASURED_TAB_WIDTHS)) {
    fireEvent(screen.getByTestId(`utility-tab-${type}-pill`), 'layout', {
      nativeEvent: { layout: { width, height: 38, x: 0, y: 0 } },
    });
  }
}

describe('UtilityTypeTabs', () => {
  beforeEach(() => {
    mockColorScheme = 'light';
    // The mocked react-native ScrollView ships with `scrollTo: jest.fn()` on
    // its prototype that accumulates calls across tests. Clear before each
    // case so behavioral assertions only see the current test's invocations.
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders utility submenus and marks the selected type', () => {
    render(<UtilityTypeTabs selectedType="power" onSelect={jest.fn()} />);

    expect(screen.getByText('Airtime')).toBeOnTheScreen();
    expect(screen.getByText('Data')).toBeOnTheScreen();
    expect(screen.getByText('TV')).toBeOnTheScreen();
    expect(screen.getByText('Power')).toBeOnTheScreen();
    expect(screen.getByText('Gaming')).toBeOnTheScreen();
    expect(screen.getAllByRole('tab')).toHaveLength(5);
  });

  const themeCases: Array<
    [colorScheme: UtilityColorScheme, expectedColors: UtilityThemeColors]
  > = [
    ['light', Colors.light],
    ['dark', Colors.dark],
  ];

  it.each(themeCases)('marks the selected type and applies %s theme styling', (colorScheme, expectedColors) => {
    mockColorScheme = colorScheme;

    render(<UtilityTypeTabs selectedType="data" onSelect={jest.fn()} />);

    expect(
      screen.getByLabelText('Data utility service')
    ).toHaveAccessibilityState({
      selected: true,
    });
    expect(
      StyleSheet.flatten(screen.getByTestId('utility-type-tabs').props.style)
    ).toMatchObject({
      backgroundColor: expectedColors.background,
      borderBottomColor: expectedColors.border,
    });
    expect(screen.getByText('Airtime')).toHaveStyle({
      color: expectedColors.text,
    });
  });

  it('keeps utility submenus rendered as flexible horizontal pills', () => {
    render(<UtilityTypeTabs selectedType="power" onSelect={jest.fn()} />);

    // Tabs auto-size above a stable minimum via paddingHorizontal, so compact
    // labels do not collapse while longer labels can still grow.
    const powerStyle = getTabStyle('power');
    expect(powerStyle).toMatchObject({
      backgroundColor: BRAND.primary,
      borderColor: BRAND.primary,
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: 'row',
      flexShrink: 0,
    });
    expect(powerStyle.minWidth).toBeGreaterThan(0);
    expect(powerStyle.paddingHorizontal).toBeGreaterThan(0);
    expect(powerStyle).not.toHaveProperty('width');

    const airtimeStyle = getTabStyle('airtime');
    expect(airtimeStyle).toMatchObject({
      backgroundColor: Colors.light.muted,
      borderColor: Colors.light.border,
    });
    expect(airtimeStyle).not.toHaveProperty('width');

    expect(
      StyleSheet.flatten(
        screen.getByTestId('utility-type-tabs-scroll').props
          .contentContainerStyle
      )
    ).toMatchObject({
      alignItems: 'center',
      paddingHorizontal: SPACING.md,
    });
  });

  it('calls onSelect when a submenu is pressed', () => {
    const onSelect = jest.fn();
    render(<UtilityTypeTabs selectedType="power" onSelect={onSelect} />);

    fireEvent.press(screen.getByLabelText('Data utility service'));

    expect(onSelect).toHaveBeenCalledWith('data');
  });

  it('scrolls the selected tab into view using the measured layout widths', () => {
    const scrollToSpy = jest
      .spyOn(ScrollView.prototype, 'scrollTo')
      .mockImplementation(() => undefined);

    render(<UtilityTypeTabs selectedType="power" onSelect={jest.fn()} />);

    act(() => {
      fireMeasuredLayouts(320);
    });

    // Expected centering math:
    //   sideInset (SPACING.md) + airtime + gap + data + gap + tv + gap = preceding offset
    //   selectedCenter = precedingOffset + power/2 - viewport/2
    const sideInset = SPACING.md;
    const gap = SPACING.sm;
    const precedingOffset =
      sideInset +
      MEASURED_TAB_WIDTHS.airtime +
      gap +
      MEASURED_TAB_WIDTHS.data +
      gap +
      MEASURED_TAB_WIDTHS.tv +
      gap;
    const expectedX = Math.max(
      0,
      precedingOffset + MEASURED_TAB_WIDTHS.power / 2 - 320 / 2
    );

    expect(scrollToSpy).toHaveBeenCalledWith({
      animated: true,
      x: expectedX,
    });
  });

  it('clamps the scroll offset to zero when the selected tab is near the start', () => {
    const scrollToSpy = jest
      .spyOn(ScrollView.prototype, 'scrollTo')
      .mockImplementation(() => undefined);

    // Render with a wide viewport so airtime's centered offset would be
    // negative; the component must clamp to 0 instead of scrolling left.
    render(<UtilityTypeTabs selectedType="airtime" onSelect={jest.fn()} />);

    act(() => {
      fireMeasuredLayouts(800);
    });

    expect(scrollToSpy).toHaveBeenCalledWith({
      animated: true,
      x: 0,
    });
  });
});

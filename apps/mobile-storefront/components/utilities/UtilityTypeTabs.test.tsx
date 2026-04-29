import { describe, expect, it, jest } from '@jest/globals';
import {
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';
import { ScrollView } from 'react-native';
import Colors from '@/constants/Colors';
import { UtilityTypeTabs } from './UtilityTypeTabs';

let mockColorScheme: 'light' | 'dark' = 'light';

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => mockColorScheme,
}));

describe('UtilityTypeTabs', () => {
  beforeEach(() => {
    mockColorScheme = 'light';
  });

  it('renders utility submenus and marks the selected type', () => {
    render(<UtilityTypeTabs selectedType="power" onSelect={jest.fn()} />);

    expect(screen.getByText('Airtime')).toBeOnTheScreen();
    expect(screen.getByText('Data')).toBeOnTheScreen();
    expect(screen.getByText('TV')).toBeOnTheScreen();
    expect(screen.getByText('Power')).toBeOnTheScreen();
    expect(screen.getByText('Gaming')).toBeOnTheScreen();
    expect(screen.getByRole('tablist')).toBeOnTheScreen();
    expect(screen.getAllByRole('tab')).toHaveLength(5);
  });

  it('marks the selected type as selected', () => {
    render(<UtilityTypeTabs selectedType="power" onSelect={jest.fn()} />);

    expect(
      screen.getByLabelText('Power utility service')
    ).toHaveAccessibilityState({
      selected: true,
    });
  });

  it('calls onSelect when a submenu is pressed', () => {
    const onSelect = jest.fn();
    render(<UtilityTypeTabs selectedType="power" onSelect={onSelect} />);

    fireEvent.press(screen.getByLabelText('Data utility service'));

    expect(onSelect).toHaveBeenCalledWith('data');
  });

  it('applies dark theme styling', () => {
    mockColorScheme = 'dark';

    render(<UtilityTypeTabs selectedType="data" onSelect={jest.fn()} />);

    const tablist = screen.getByRole('tablist');
    expect(tablist).toHaveStyle({
      backgroundColor: Colors.dark.background,
      borderBottomColor: Colors.dark.border,
    });
    expect(screen.getByText('Airtime')).toHaveStyle({
      color: Colors.dark.text,
    });
  });

  it('marks the selected tab in dark mode', () => {
    mockColorScheme = 'dark';

    render(<UtilityTypeTabs selectedType="data" onSelect={jest.fn()} />);

    const tablist = screen.getByRole('tablist');
    expect(
      within(tablist).getByLabelText('Data utility service')
    ).toHaveAccessibilityState({
      selected: true,
    });
  });

  it('keeps taps handled while horizontally scrolling tabs', () => {
    const { UNSAFE_getByType } = render(
      <UtilityTypeTabs selectedType="power" onSelect={jest.fn()} />
    );

    expect(UNSAFE_getByType(ScrollView).props.keyboardShouldPersistTaps).toBe(
      'handled'
    );
  });

  it('applies visual feedback while a tab is pressed', () => {
    render(<UtilityTypeTabs selectedType="power" onSelect={jest.fn()} />);

    const tab = screen.getByLabelText('Data utility service');
    fireEvent(tab, 'pressIn');

    expect(screen.getByLabelText('Data utility service')).toHaveStyle({
      opacity: 0.88,
    });
  });
});

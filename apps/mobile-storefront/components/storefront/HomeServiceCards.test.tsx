import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Animated, StyleSheet } from 'react-native';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'dark',
}));

const { HomeServiceCards } =
  jest.requireActual<typeof import('./HomeServiceCards')>('./HomeServiceCards');

describe('HomeServiceCards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Animated, 'loop').mockReturnValue({
      reset: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
    } as unknown as ReturnType<typeof Animated.loop>);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the three home service shortcuts', () => {
    render(<HomeServiceCards />);

    expect(screen.getByText('IMEI Checker')).toBeTruthy();
    expect(screen.getByText('Repair Lab')).toBeTruthy();
    expect(screen.getByText('Swap/Trade')).toBeTruthy();
  });

  it('starts one shared moving outline animation', () => {
    render(<HomeServiceCards />);

    expect(Animated.loop).toHaveBeenCalledTimes(1);
  });

  it('uses separate spacing for above and below utility placements', () => {
    const { rerender } = render(<HomeServiceCards />);

    expect(
      StyleSheet.flatten(screen.getByTestId('home-service-cards').props.style)
    ).toMatchObject({
      marginTop: 28,
      marginBottom: -2,
    });

    rerender(<HomeServiceCards placement="aboveUtility" />);

    expect(
      StyleSheet.flatten(screen.getByTestId('home-service-cards').props.style)
    ).toMatchObject({
      marginTop: 8,
      marginBottom: -8,
      transform: [{ translateY: -14 }],
    });
  });

  it('routes each shortcut to its service screen', () => {
    render(<HomeServiceCards />);

    fireEvent.press(
      screen.getByLabelText('IMEI Checker. Verify before buying')
    );
    expect(mockPush).toHaveBeenLastCalledWith('/imei-check');

    fireEvent.press(screen.getByLabelText('Repair Lab. Fix phones fast'));
    expect(mockPush).toHaveBeenLastCalledWith('/repairs');

    fireEvent.press(screen.getByLabelText('Swap/Trade. Swap for credit'));
    expect(mockPush).toHaveBeenLastCalledWith('/swap');
  });
});

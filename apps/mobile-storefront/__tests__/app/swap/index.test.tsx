import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import SwapScreen from '@/app/swap';

jest.mock('expo-router', () => ({
  Stack: {
    Screen: () => null,
  },
  router: {
    back: jest.fn(),
    push: jest.fn(),
  },
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

describe('SwapScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the current swap overview content', () => {
    render(<SwapScreen />);

    expect(screen.getByText('Swap & Trade-in')).toBeOnTheScreen();
    expect(screen.getByText('How it Works')).toBeOnTheScreen();
    expect(screen.getByText('What can you trade in?')).toBeOnTheScreen();
    expect(screen.getByText('iPhones (11 and newer)')).toBeOnTheScreen();
  });

  it('opens the AI trade-in modal from the hero call-to-action', () => {
    render(<SwapScreen />);

    fireEvent.press(screen.getByText('Start AI Trade-in'));

    expect(screen.getByText('AI Trade-in Valuator')).toBeOnTheScreen();
    expect(screen.getByText('Analyze Device')).toBeOnTheScreen();
  });
});

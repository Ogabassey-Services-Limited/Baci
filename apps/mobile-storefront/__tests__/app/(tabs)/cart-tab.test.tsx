import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import CartTabScreen from '@/app/(tabs)/cart-tab';

jest.mock('@/app/cart', () => {
  const { Text } =
    jest.requireActual<typeof import('react-native')>('react-native');

  return function MockCartScreen() {
    return <Text>Warm cart screen</Text>;
  };
});

describe('CartTabScreen', () => {
  it('renders the real cart screen inside the tab navigator', () => {
    render(<CartTabScreen />);

    expect(screen.getByText('Warm cart screen')).toBeTruthy();
  });
});

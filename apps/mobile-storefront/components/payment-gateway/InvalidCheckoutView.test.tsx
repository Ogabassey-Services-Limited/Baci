import { jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { InvalidCheckoutView } from './InvalidCheckoutView';

const mockStackScreen = jest.fn((_props: unknown) => null);

jest.mock('expo-router', () => ({
  Stack: {
    Screen: (props: unknown) => mockStackScreen(props),
  },
}));

describe('InvalidCheckoutView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the invalid checkout message and routes back', () => {
    const onBack = jest.fn();

    render(
      <InvalidCheckoutView
        colors={Colors.light}
        error="Missing checkout URL"
        onBack={onBack}
      />
    );

    expect(screen.getByText('Invalid Checkout')).toBeOnTheScreen();
    expect(screen.getByText('Missing checkout URL')).toBeOnTheScreen();
    expect(mockStackScreen).toHaveBeenCalledWith({
      options: expect.objectContaining({ title: 'Invalid Checkout' }),
    });

    fireEvent.press(screen.getByLabelText('Go back'));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

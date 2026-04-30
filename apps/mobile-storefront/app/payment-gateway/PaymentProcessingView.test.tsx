import { jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { PaymentProcessingView } from './PaymentProcessingView';

const mockStackScreen = jest.fn((_props: unknown) => null);

jest.mock('expo-router', () => ({
  Stack: {
    Screen: (props: unknown) => mockStackScreen(props),
  },
}));

describe('PaymentProcessingView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders utility purchase confirmation copy', () => {
    render(<PaymentProcessingView colors={Colors.light} />);

    expect(screen.getByText('Confirming Utility Purchase')).toBeOnTheScreen();
    expect(
      screen.getByText(
        "We're confirming your token and receipt. This usually takes a few seconds."
      )
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Confirming utility purchase')
    ).toBeOnTheScreen();
  });

  it('hides the route header while payment confirmation is pending', () => {
    render(<PaymentProcessingView colors={Colors.light} />);

    expect(mockStackScreen).toHaveBeenCalledWith({
      options: { headerShown: false },
    });
  });
});

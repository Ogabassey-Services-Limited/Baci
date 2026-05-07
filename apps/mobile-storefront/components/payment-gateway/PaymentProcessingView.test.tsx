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

  it('renders utility token-generation copy', () => {
    render(
      <PaymentProcessingView
        colors={Colors.light}
        paymentKind="vtu"
        utilityType="power"
      />
    );

    expect(screen.getByText('Payment Received')).toBeOnTheScreen();
    expect(
      screen.getByText(
        "We're generating your token now. This usually takes 30-60 seconds, and we'll notify you when it's ready."
      )
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Generating utility token')
    ).toBeOnTheScreen();
  });

  it('renders non-token utility completion copy', () => {
    render(
      <PaymentProcessingView
        colors={Colors.light}
        paymentKind="vtu"
        utilityType="data"
      />
    );

    expect(screen.getByText('Payment Received')).toBeOnTheScreen();
    expect(
      screen.getByText(
        "We're completing your utility purchase now. This usually takes a few seconds."
      )
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Completing utility purchase')
    ).toBeOnTheScreen();
  });

  it('hides the route header while payment confirmation is pending', () => {
    render(<PaymentProcessingView colors={Colors.light} />);

    expect(mockStackScreen).toHaveBeenCalledWith({
      options: { headerShown: false },
    });
  });
});

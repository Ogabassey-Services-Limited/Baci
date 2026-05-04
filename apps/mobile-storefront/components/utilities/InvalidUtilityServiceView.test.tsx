import { jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { InvalidUtilityServiceView } from '@/components/utilities/InvalidUtilityServiceView';
import Colors from '@/constants/Colors';

const mockStackScreen = jest.fn((_props: unknown) => null);

jest.mock('expo-router', () => ({
  Stack: {
    Screen: (props: unknown) => mockStackScreen(props),
  },
}));

describe('InvalidUtilityServiceView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the invalid service copy and hides the native header', () => {
    render(
      <InvalidUtilityServiceView
        colors={Colors.light}
        onBack={jest.fn()}
        topInset={24}
      />
    );

    expect(screen.getByText('Invalid Service')).toBeOnTheScreen();
    expect(screen.getByText('Service Not Found')).toBeOnTheScreen();
    expect(
      screen.getByText('The requested utility service is not available.')
    ).toBeOnTheScreen();
    expect(mockStackScreen).toHaveBeenCalledWith({
      options: { headerShown: false },
    });
  });

  it('wires both back actions to the provided callback', () => {
    const onBack = jest.fn();

    render(
      <InvalidUtilityServiceView
        colors={Colors.light}
        onBack={onBack}
        topInset={24}
      />
    );

    fireEvent.press(screen.getByLabelText('Go back'));
    fireEvent.press(screen.getByLabelText('Go back to previous screen'));

    expect(onBack).toHaveBeenCalledTimes(2);
  });
});

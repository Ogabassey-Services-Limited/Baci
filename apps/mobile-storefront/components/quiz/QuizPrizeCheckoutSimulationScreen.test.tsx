import { fireEvent, render, screen } from '@testing-library/react-native';
import { QuizPrizeCheckoutSimulationScreen } from './QuizPrizeCheckoutSimulationScreen';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
}));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('@/components/checkout/CheckoutScreenView', () => ({
  CheckoutScreenView: ({
    prizeSimulation,
  }: {
    prizeSimulation: {
      item: { name: string; price: number };
      onComplete: () => void;
    };
  }) => {
    const React = jest.requireActual('react') as typeof import('react');
    const { Pressable, Text } = jest.requireActual(
      'react-native'
    ) as typeof import('react-native');
    return (
      <React.Fragment>
        <Text>{`${prizeSimulation.item.name}: ${prizeSimulation.item.price}`}</Text>
        <Pressable
          accessibilityLabel="Complete simulation"
          accessibilityRole="button"
          onPress={prizeSimulation.onComplete}
        >
          <Text>Complete</Text>
        </Pressable>
      </React.Fragment>
    );
  },
}));

describe('QuizPrizeCheckoutSimulationScreen', () => {
  beforeEach(() => {
    mockReplace.mockClear();
  });

  it('prices the test prize at zero and ends on a non-mutating confirmation', () => {
    render(
      <QuizPrizeCheckoutSimulationScreen
        prize={{
          condition: 'used',
          id: 'product-1',
          imageUrl: null,
          name: 'iPhone XR',
          variantId: null,
        }}
      />
    );

    expect(screen.getByText('iPhone XR: 0')).toBeOnTheScreen();
    fireEvent.press(
      screen.getByRole('button', { name: 'Complete simulation' })
    );

    expect(screen.getByText('Prize checkout confirmed')).toBeOnTheScreen();
    expect(
      screen.getByText(/created no order, charged no payment/)
    ).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Back to quizzes' }));
    expect(mockReplace).toHaveBeenCalledWith('/quiz');
  });
});

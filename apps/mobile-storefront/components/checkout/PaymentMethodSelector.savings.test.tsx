import { fireEvent, render, screen } from '@testing-library/react-native';
import {
  PaymentMethodSelector,
  type PaymentMethodType,
} from './PaymentMethodSelector';

jest.mock('expo-image', () => ({
  Image: () => null,
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'dark',
}));

describe('PaymentMethodSelector', () => {
  describe('device savings row', () => {
    it('renders nothing savings-related without a funded matching goal', () => {
      render(
        <PaymentMethodSelector
          selectedMethod={'paystack' as PaymentMethodType}
          onSelectMethod={() => {}}
          selectedTab="full"
          onSelectTab={() => {}}
          orderTotal={1000}
          savingsBalance={0}
          savingsGoalId="123e4567-e89b-12d3-a456-426614174555"
          savingsGoalTitle="iPhone savings"
        />
      );

      expect(screen.queryByLabelText(/device savings/i)).toBeNull();
    });

    it('does not treat a null savings goal id as an active savings selection', () => {
      render(
        <PaymentMethodSelector
          selectedMethod={'paystack' as PaymentMethodType}
          onSelectMethod={() => {}}
          selectedTab="full"
          onSelectTab={() => {}}
          orderTotal={100000}
          savingsBalance={60000}
          savingsGoalId={null}
          savingsSelection={{ use: true, goalId: null, amount: 60000 }}
          walletMode="orders"
          walletBalance={50000}
          walletOrderTotal={100000}
        />
      );

      expect(
        screen.getByRole('button', { name: /use wallet credit/i })
      ).toBeTruthy();
    });

    it('renders the savings row for compatible full-payment methods', () => {
      render(
        <PaymentMethodSelector
          selectedMethod={'paystack' as PaymentMethodType}
          onSelectMethod={() => {}}
          selectedTab="full"
          onSelectTab={() => {}}
          orderTotal={100000}
          savingsBalance={60000}
          savingsGoalId="123e4567-e89b-12d3-a456-426614174555"
          savingsGoalTitle="iPhone savings"
        />
      );

      expect(screen.getByLabelText(/use device savings/i)).toBeTruthy();
      expect(screen.getByText(/₦60,000/)).toBeTruthy();
      expect(screen.getByText(/₦40,000/)).toBeTruthy();
    });

    it('uses the caller-provided savings fallback title when a goal title is absent', () => {
      render(
        <PaymentMethodSelector
          selectedMethod={'paystack' as PaymentMethodType}
          onSelectMethod={() => {}}
          selectedTab="full"
          onSelectTab={() => {}}
          orderTotal={100000}
          savingsBalance={60000}
          savingsFallbackTitle="phone savings"
          savingsGoalId="123e4567-e89b-12d3-a456-426614174555"
        />
      );

      expect(screen.getByText(/from phone savings/i)).toBeTruthy();
    });

    it('emits savingsSelection with the clamped savings amount when toggled on', () => {
      const onSavingsToggle = jest.fn();

      render(
        <PaymentMethodSelector
          selectedMethod={'bank_transfer' as PaymentMethodType}
          onSelectMethod={() => {}}
          selectedTab="full"
          onSelectTab={() => {}}
          orderTotal={100000}
          savingsBalance={160000}
          savingsGoalId="123e4567-e89b-12d3-a456-426614174555"
          savingsGoalTitle="iPhone savings"
          onSavingsToggle={onSavingsToggle}
        />
      );

      fireEvent.press(screen.getByLabelText(/pay with device savings/i));

      expect(onSavingsToggle).toHaveBeenCalledWith({
        use: true,
        goalId: '123e4567-e89b-12d3-a456-426614174555',
        amount: 100000,
      });
    });

    it('uses the savings residual when calculating the wallet row after savings is active', () => {
      render(
        <PaymentMethodSelector
          selectedMethod={'paystack' as PaymentMethodType}
          onSelectMethod={() => {}}
          selectedTab="full"
          onSelectTab={() => {}}
          orderTotal={100000}
          savingsBalance={60000}
          savingsGoalId="123e4567-e89b-12d3-a456-426614174555"
          savingsGoalTitle="iPhone savings"
          savingsSelection={{
            use: true,
            goalId: '123e4567-e89b-12d3-a456-426614174555',
            amount: 60000,
          }}
          walletMode="orders"
          walletBalance={50000}
          walletOrderTotal={100000}
        />
      );

      expect(screen.getByLabelText(/pay with wallet/i)).toBeTruthy();
      expect(screen.getByText(/covers full order/i)).toBeTruthy();
    });

    it('does not mark savings active when the selected goal changed', () => {
      const onSavingsToggle = jest.fn();

      render(
        <PaymentMethodSelector
          selectedMethod={'paystack' as PaymentMethodType}
          onSelectMethod={() => {}}
          selectedTab="full"
          onSelectTab={() => {}}
          orderTotal={100000}
          savingsBalance={60000}
          savingsGoalId="current-goal"
          savingsGoalTitle="iPhone savings"
          savingsSelection={{
            use: true,
            goalId: 'stale-goal',
            amount: 60000,
          }}
          onSavingsToggle={onSavingsToggle}
        />
      );

      const savingsRow = screen.getByLabelText(/use device savings/i);

      fireEvent.press(savingsRow);

      expect(onSavingsToggle).toHaveBeenCalledWith({
        use: true,
        goalId: 'current-goal',
        amount: 60000,
      });
    });

    it('hides savings for BNPL and incompatible full-payment methods', () => {
      render(
        <PaymentMethodSelector
          selectedMethod={'pay_on_delivery' as PaymentMethodType}
          onSelectMethod={() => {}}
          selectedTab="full"
          onSelectTab={() => {}}
          orderTotal={100000}
          savingsBalance={60000}
          savingsGoalId="123e4567-e89b-12d3-a456-426614174555"
          savingsGoalTitle="iPhone savings"
        />
      );

      expect(screen.queryByLabelText(/device savings/i)).toBeNull();
    });
  });
});

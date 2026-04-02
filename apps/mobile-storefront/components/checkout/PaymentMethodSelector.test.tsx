import { render, screen } from '@testing-library/react-native';
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
  it('shows the Lagos availability note for pay on delivery without the removed fee copy', () => {
    render(
      <PaymentMethodSelector
        selectedMethod={'pay_on_delivery' as PaymentMethodType}
        onSelectMethod={() => {}}
        selectedTab="full"
        onSelectTab={() => {}}
        orderTotal={120000}
      />
    );

    expect(screen.getByText('Available in Lagos only.')).toBeTruthy();
    expect(
      screen.queryByText(/5% processing fee may apply/i)
    ).toBeNull();
  });
});

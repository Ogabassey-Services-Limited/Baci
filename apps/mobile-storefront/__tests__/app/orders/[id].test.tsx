jest.mock('@/components/orders/OrderDetailsScreen', () => ({
  OrderDetailsScreen: () => {
    const { Text } = require('react-native');
    return <Text>Order details shell</Text>;
  },
}));

import { render, screen } from '@testing-library/react-native';
import OrderDetailsRoute from '@/app/orders/[id]';

describe('OrderDetailsRoute', () => {
  it('renders the order details screen shell component', () => {
    render(<OrderDetailsRoute />);
    expect(screen.getByText('Order details shell')).toBeOnTheScreen();
  });
});

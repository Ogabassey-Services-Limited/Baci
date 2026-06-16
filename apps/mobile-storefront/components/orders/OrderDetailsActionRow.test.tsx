import { fireEvent, render, screen } from '@testing-library/react-native';
import { OrderDetailsActionRow } from './OrderDetailsActionRow';

const colors = {
  border: '#e5e7eb',
  text: '#111827',
  textSecondary: '#6b7280',
} as const;

describe('OrderDetailsActionRow', () => {
  it('renders the title and description and fires onPress', () => {
    const onPress = jest.fn();

    render(
      <OrderDetailsActionRow
        accessibilityLabel="Cancel order"
        accessoryIcon="chevron-forward"
        colors={colors}
        description="Cancel this order before it ships."
        icon="close-circle-outline"
        iconColor="#DC2626"
        iconSurface="rgba(220, 38, 38, 0.10)"
        onPress={onPress}
        title="Cancel Order"
      />
    );

    expect(screen.getByText('Cancel Order')).toBeTruthy();
    expect(screen.getByText('Cancel this order before it ships.')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: /cancel order/i }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('tints the title with the icon color when titleColor is provided', () => {
    render(
      <OrderDetailsActionRow
        accessibilityLabel="Cancel order"
        accessoryIcon="chevron-forward"
        colors={colors}
        description="Cancel this order before it ships."
        icon="close-circle-outline"
        iconColor="#DC2626"
        iconSurface="rgba(220, 38, 38, 0.10)"
        onPress={jest.fn()}
        title="Cancel Order"
        titleColor="#DC2626"
      />
    );

    const title = screen.getByText('Cancel Order');
    expect(title.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: '#DC2626' })])
    );
  });
});

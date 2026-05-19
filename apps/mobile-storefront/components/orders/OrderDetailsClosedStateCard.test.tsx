import { render, screen } from '@testing-library/react-native';
import { getCustomerOrderStatusMeta } from '@/lib/customer-order-status';
import { OrderDetailsClosedStateCard } from './OrderDetailsClosedStateCard';

const statusPalette = {
  accent: '#dc2626',
  border: 'rgba(220, 38, 38, 0.18)',
  surface: 'rgba(220, 38, 38, 0.10)',
} as const;

describe('OrderDetailsClosedStateCard', () => {
  const textSecondaryColor = '#6b7280';

  it.each(['cancelled', 'returned', 'refunded'])(
    'renders label, description, and colors for %s status',
    (status) => {
      const statusMeta = getCustomerOrderStatusMeta(status);

      render(
        <OrderDetailsClosedStateCard
          statusMeta={statusMeta}
          statusPalette={statusPalette}
          textSecondaryColor={textSecondaryColor}
        />
      );

      screen.getByLabelText(`${statusMeta.key} status icon`);
      const label = screen.getByText(statusMeta.label);
      const description = screen.getByText(statusMeta.description);

      expect(label).toHaveStyle({ color: statusPalette.accent });
      expect(description).toHaveStyle({ color: textSecondaryColor });
    }
  );

  it('renders gracefully when the description is empty', () => {
    const statusMeta = {
      ...getCustomerOrderStatusMeta('cancelled'),
      description: '',
    };

    render(
      <OrderDetailsClosedStateCard
        statusMeta={statusMeta}
        statusPalette={statusPalette}
        textSecondaryColor={textSecondaryColor}
      />
    );

    screen.getByText(statusMeta.label);
  });
});

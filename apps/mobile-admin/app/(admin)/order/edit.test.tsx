import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import EditOrderScreen from '@/app/(admin)/order/edit';

const controllerState = vi.hoisted(() => ({
  current: { orderId: 'order-1' } as { orderId?: string },
}));

vi.mock('@/hooks/useEditOrderController', () => ({
  useEditOrderController: () => controllerState.current,
}));

vi.mock('@/components/orders/EditOrderScreenContent', () => ({
  EditOrderScreenContent: () => <div>Edit screen content</div>,
}));

vi.mock('@/components/ui/InvalidRouteScreen', () => ({
  InvalidRouteScreen: ({ title }: { title: string }) => <div>{title}</div>,
}));

describe('EditOrderScreen route', () => {
  it('renders edit content when an order id is present', () => {
    controllerState.current = { orderId: 'order-1' };

    render(<EditOrderScreen />);

    expect(screen.getByText('Edit screen content')).toBeInTheDocument();
  });

  it('renders invalid route state when no order id is present', () => {
    controllerState.current = {};

    render(<EditOrderScreen />);

    expect(screen.getByText('Invalid Order')).toBeInTheDocument();
  });
});

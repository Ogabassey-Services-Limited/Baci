import './orders-screen-test-utils';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OrdersStatusDropdown } from './OrdersStatusDropdown';
import { mockColors, mockOrder, mockShadows } from './orders-screen-test-utils';

describe('OrdersStatusDropdown', () => {
  it('renders available status actions and selects one', () => {
    const onStatusUpdate = vi.fn();

    render(
      <OrdersStatusDropdown
        colors={mockColors}
        dropdownPosition={{ x: 10, y: 20 }}
        getStatusActions={() => [
          {
            status: 'processing',
            label: 'Confirm Order',
            icon: 'checkmark-circle-outline',
            color: mockColors.processing,
          },
        ]}
        isUpdating={false}
        onClose={vi.fn()}
        onStatusUpdate={onStatusUpdate}
        selectedOrder={mockOrder}
        shadows={mockShadows}
        visible={true}
      />
    );

    fireEvent.click(screen.getByRole('menuitem', { name: 'Confirm Order' }));

    expect(onStatusUpdate).toHaveBeenCalledWith('processing');
  });

  it('renders nothing when hidden', () => {
    const { container } = render(
      <OrdersStatusDropdown
        colors={mockColors}
        dropdownPosition={{ x: 10, y: 20 }}
        getStatusActions={() => []}
        isUpdating={false}
        onClose={vi.fn()}
        onStatusUpdate={vi.fn()}
        selectedOrder={null}
        shadows={mockShadows}
        visible={false}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});

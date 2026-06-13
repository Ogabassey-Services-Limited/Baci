import './orders-screen-test-utils';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OrdersDateChip } from './OrdersDateChip';
import { mockColors } from './orders-screen-test-utils';

describe('OrdersDateChip', () => {
  it('renders the active date label and clears it', () => {
    const onClear = vi.fn();

    render(
      <OrdersDateChip
        colors={mockColors}
        label="Jun 1 - Jun 12"
        onClear={onClear}
      />
    );

    expect(screen.getByText('Jun 1 - Jun 12')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear date filter' }));

    expect(onClear).toHaveBeenCalledOnce();
  });
});
